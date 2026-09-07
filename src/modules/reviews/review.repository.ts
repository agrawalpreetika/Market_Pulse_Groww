import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/infrastructure/database/prisma";
import { CURRENT_CHANGE_POLICY_VERSION } from "@/modules/change-detection/change-detection-policy";
import { classifyQuoteFreshness } from "@/modules/market-data/classify-quote-freshness";
import { buildDailyReferenceContext } from "@/modules/change-detection/build-daily-reference-context";

async function createOrReuseInTransaction(
  watchlistId: string,
  userId: string,
) {
  return prisma.$transaction(
    async (transaction) => {
      const existingOpenReview =
        await transaction.watchlistReview.findFirst({
          where: {
            watchlistId,
            userId,
            status: "OPEN",
          },

          include: {
            items: {
              orderBy: {
                createdAt: "asc",
              },

              include: {
                instrument: {
                  select: {
                    id: true,
                    symbol: true,
                    name: true,
                    exchange: true,
                    currency: true,
                  },
                },
              },
            },
          },
        });

      if (existingOpenReview) {
        return {
          created: false,
          review: existingOpenReview,
        };
      }

      const snapshotAt = new Date();

      const watchlist =
        await transaction.watchlist.findFirst({
          where: {
            id: watchlistId,
            userId,
          },

          include: {
            items: {
              orderBy: [
                {
                  displayOrder: "asc",
                },
                {
                  addedAt: "asc",
                },
              ],

              include: {
                instrument: {
                  include: {
                    latestQuote: true,
                  },
                },
              },
            },
          },
        });

      if (!watchlist) {
        return null;
      }

      const ids = watchlist.items.map(item => item.instrumentId);
      const baselineReview =
        await transaction.watchlistReview.findFirst({
          where: {
            watchlistId,
            userId,
            status: "ACKNOWLEDGED",
          },

          orderBy: {
            acknowledgedAt: "desc",
          },

          select: {
            id: true,
            snapshotAt: true,
            items: {
              select: {
                instrumentId: true,
                providerTimestamp: true,
              },
            },
          },
        });

      const dailyBars = ids.length === 0
        ? []
        : await transaction.dailyPriceBar.findMany({
            where: {
              instrumentId: { in: ids },
              tradingDate: {
                gte: new Date(snapshotAt.getTime() - 120 * 86_400_000),
              },
              receivedAt: { lte: snapshotAt },
            },
            orderBy: { tradingDate: "asc" },
          });

      const baselineItems = new Map(
        baselineReview?.items.map((item) => [item.instrumentId, item]) ?? [],
      );

      const review =
        await transaction.watchlistReview.create({
          data: {
            watchlistId,
            userId,
            policyVersion:
  CURRENT_CHANGE_POLICY_VERSION,
            baselineReviewId:
              baselineReview?.id ?? null,
            snapshotAt,

            items: {
  create: watchlist.items.map((item) => {
    const quote =
      item.instrument.latestQuote;

    const freshness = quote
      ? classifyQuoteFreshness({
          providerTimestamp:
            quote.providerTimestamp,
          quality: quote.quality,
          session: quote.session,
          now: snapshotAt,
        })
      : null;

    const baselineItem = baselineItems.get(item.instrumentId);
    const reference = buildDailyReferenceContext({
      currentSource: quote?.source ?? null,
      currentTimestamp: quote?.providerTimestamp ?? null,
      baselineTimestamp: baselineItem?.providerTimestamp ?? baselineReview?.snapshotAt ?? null,
      timezone: item.instrument.timezone,
      bars: dailyBars.filter((bar) => bar.instrumentId === item.instrumentId).map((bar) => ({
        tradingDate: bar.tradingDate,
        open: bar.open.toNumber(),
        high: bar.high.toNumber(),
        low: bar.low.toNumber(),
        close: bar.close.toNumber(),
        adjustedClose: bar.adjustedClose?.toNumber() ?? null,
        volume: bar.volume,
        source: bar.source,
      })),
    });

    return {
      instrumentId: item.instrument.id,

      price: quote?.price ?? null,

      previousClose:
        quote?.previousClose ?? null,

      volume: quote?.volume ?? null,

      quoteQuality:
        quote?.quality ?? null,
      
      quoteSource:
        quote?.source ?? null,

      marketSession:
        quote?.session ?? null,

      freshnessStatus:
        freshness?.status ?? "UNKNOWN",

      quoteAgeSeconds:
        freshness?.ageSeconds ?? null,

      customThresholdPercent:
        item.customThreshold ?? null,

      referenceSampleCount: reference.sampleCount,
      referenceVolatilityPercent: reference.volatilityPercent,
      referenceHigh: reference.recentHigh,
      referenceLow: reference.recentLow,
      referenceMedianVolume: reference.medianDailyVolume,
      referenceVolumeSampleCount: reference.volumeSampleCount,
      referenceHorizonSessions: reference.horizonSessions,
      referenceSource: reference.source,
      referencePriceBasis: reference.priceBasis,

      providerTimestamp:
        quote?.providerTimestamp ?? null,
    };
  }),
},
          },

          include: {
            items: {
              orderBy: {
                createdAt: "asc",
              },

              include: {
                instrument: {
                  select: {
                    id: true,
                    symbol: true,
                    name: true,
                    exchange: true,
                    currency: true,
                  },
                },
              },
            },
          },
        });

      return {
        created: true,
        review,
      };
    },
    {
      isolationLevel:
        Prisma.TransactionIsolationLevel.Serializable,
    },
  );
}

export const reviewRepository = {
  async createOrReuseOpenReview(
    watchlistId: string,
    userId: string,
  ) {
    const maximumAttempts = 3;

    for (
      let attempt = 1;
      attempt <= maximumAttempts;
      attempt += 1
    ) {
      try {
        return await createOrReuseInTransaction(
          watchlistId,
          userId,
        );
      } catch (error: unknown) {
        const isSerializationConflict =
          error instanceof
            Prisma.PrismaClientKnownRequestError &&
          error.code === "P2034";

        const shouldRetry =
          isSerializationConflict &&
          attempt < maximumAttempts;

        if (shouldRetry) {
          continue;
        }

        throw error;
      }
    }

    throw new Error(
      "Review creation exhausted all retry attempts",
    );
    },
    
    async acknowledge(
  reviewId: string,
  watchlistId: string,
  userId: string,
  expectedVersion: number,
) {
  return prisma.$transaction(async (transaction) => {
    const updateResult =
      await transaction.watchlistReview.updateMany({
        where: {
          id: reviewId,
          watchlistId,
          userId,
          status: "OPEN",
          version: expectedVersion,
        },
        data: {
          status: "ACKNOWLEDGED",
          acknowledgedAt: new Date(),
          version: {
            increment: 1,
          },
        },
      });

    if (updateResult.count === 1) {
      const review =
        await transaction.watchlistReview.findUnique({
          where: {
            id: reviewId,
          },
          include: {
            items: {
              include: {
                instrument: {
                  select: {
                    id: true,
                    symbol: true,
                    name: true,
                    exchange: true,
                    currency: true,
                  },
                },
              },
            },
          },
        });

      return {
        outcome: "ACKNOWLEDGED" as const,
        review,
      };
    }

    const currentReview =
      await transaction.watchlistReview.findFirst({
        where: {
          id: reviewId,
          watchlistId,
          userId,
        },
        select: {
          id: true,
          status: true,
          version: true,
        },
      });

    if (!currentReview) {
      return {
        outcome: "NOT_FOUND" as const,
      };
    }

    if (currentReview.status !== "OPEN") {
      return {
        outcome: "NOT_OPEN" as const,
        currentStatus: currentReview.status,
      };
    }

    return {
      outcome: "VERSION_CONFLICT" as const,
      currentVersion: currentReview.version,
    };
  });
    },
    
    async findWithBaseline(
  reviewId: string,
  watchlistId: string,
  userId: string,
) {
  return prisma.watchlistReview.findFirst({
    where: {
      id: reviewId,
      watchlistId,
      userId,
    },

    include: {
      items: {
        include: {
          instrument: {
            select: {
              id: true,
              symbol: true,
              name: true,
              exchange: true,
              currency: true,
            },
          },
        },
      },

      baselineReview: {
        include: {
          items: true,
        },
      },
    },
  });
},
};
