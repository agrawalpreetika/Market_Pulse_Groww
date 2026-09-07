import { prisma } from "@/infrastructure/database/prisma";

import type { ProviderDailyPriceBar } from "./daily-price-history.types";

export const dailyPriceHistoryRepository = {
  async upsertCompletedBars(bars: ProviderDailyPriceBar[]) {
    let upserted = 0;

    await prisma.$transaction(async (transaction) => {
      for (const bar of bars) {
        await transaction.dailyPriceBar.upsert({
          where: {
            instrumentId_source_tradingDate: {
              instrumentId: bar.instrumentId,
              source: bar.source,
              tradingDate: bar.tradingDate,
            },
          },
          create: bar,
          update: {
            open: bar.open,
            high: bar.high,
            low: bar.low,
            close: bar.close,
            adjustedClose: bar.adjustedClose,
            volume: bar.volume,
            adjustment: bar.adjustment,
            providerTimestamp: bar.providerTimestamp,
            receivedAt: bar.receivedAt,
          },
        });
        upserted += 1;
      }
    });

    return { received: bars.length, upserted };
  },

  findRecentCompleted(instrumentId: string, limit = 60) {
    return prisma.dailyPriceBar.findMany({
      where: { instrumentId },
      orderBy: { tradingDate: "desc" },
      take: limit,
    });
  },

  findSyncStates(instrumentIds: string[], source: string) {
    if (instrumentIds.length === 0) return [];

    return prisma.dailyHistorySyncState.findMany({
      where: {
        instrumentId: { in: instrumentIds },
        source,
      },
    });
  },

  async recordSyncResults(input: {
    instrumentIds: string[];
    successfulInstrumentIds: Set<string>;
    source: string;
    checkedThroughDate: Date;
    attemptedAt: Date;
  }) {
    await prisma.$transaction(
      input.instrumentIds.map((instrumentId) => {
        const succeeded = input.successfulInstrumentIds.has(instrumentId);

        return prisma.dailyHistorySyncState.upsert({
          where: {
            instrumentId_source: {
              instrumentId,
              source: input.source,
            },
          },
          create: {
            instrumentId,
            source: input.source,
            checkedThroughDate: succeeded ? input.checkedThroughDate : null,
            lastAttemptAt: input.attemptedAt,
            lastSucceededAt: succeeded ? input.attemptedAt : null,
          },
          update: {
            lastAttemptAt: input.attemptedAt,
            ...(succeeded
              ? {
                  checkedThroughDate: input.checkedThroughDate,
                  lastSucceededAt: input.attemptedAt,
                }
              : {}),
          },
        });
      }),
    );
  },

  deleteOlderThan(cutoff: Date) {
    return prisma.dailyPriceBar.deleteMany({
      where: { tradingDate: { lt: cutoff } },
    });
  },
};
