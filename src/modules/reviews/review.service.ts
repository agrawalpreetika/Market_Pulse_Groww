import { AppError } from "@/shared/errors/app-error";

import { reviewRepository } from "./review.repository";

import { getChangeDetectionPolicy } from "@/modules/change-detection/change-detection-policy";

import {
  calculateMeaningfulChange,
  getAttentionRank,
} from "./calculate-meaningful-change";

export const reviewService = {
  async createOrReuseOpenReview(
    watchlistId: string,
    userId: string,
  ) {
    const result =
      await reviewRepository.createOrReuseOpenReview(
        watchlistId,
        userId,
      );

    if (!result) {
      throw new AppError(
        "Watchlist not found",
        "WATCHLIST_NOT_FOUND",
        404,
      );
    }

    return {
      created: result.created,

      review: {
        id: result.review.id,
        watchlistId:
          result.review.watchlistId,
        baselineReviewId:
          result.review.baselineReviewId,
        snapshotAt:
          result.review.snapshotAt,
        status: result.review.status,
        version: result.review.version,
        acknowledgedAt:
          result.review.acknowledgedAt,

        items: result.review.items.map(
          (item) => ({
            id: item.id,

            instrument: {
              id: item.instrument.id,
              symbol: item.instrument.symbol,
              name: item.instrument.name,
              exchange: item.instrument.exchange,
              currency: item.instrument.currency,
            },

            price:
              item.price?.toString() ?? null,

            previousClose:
              item.previousClose?.toString() ??
              null,

            volume:
              item.volume?.toString() ?? null,

            quoteQuality:
  item.quoteQuality,

    quoteSource:
  item.quoteSource,
            
marketSession:
  item.marketSession,

freshnessStatus:
  item.freshnessStatus,

quoteAgeSeconds:
  item.quoteAgeSeconds,

providerTimestamp:
  item.providerTimestamp,
          }),
        ),
      },
    };
    },
    
    async acknowledge(
  reviewId: string,
  watchlistId: string,
  userId: string,
  expectedVersion: number,
) {
  const result = await reviewRepository.acknowledge(
    reviewId,
    watchlistId,
    userId,
    expectedVersion,
  );

  if (result.outcome === "NOT_FOUND") {
    throw new AppError(
      "Review not found",
      "REVIEW_NOT_FOUND",
      404,
    );
  }

  if (result.outcome === "NOT_OPEN") {
    throw new AppError(
      `Review cannot be acknowledged because its status is ${result.currentStatus}`,
      "REVIEW_NOT_OPEN",
      409,
    );
  }

  if (result.outcome === "VERSION_CONFLICT") {
    throw new AppError(
      `Review has changed. Its current version is ${result.currentVersion}`,
      "REVIEW_VERSION_CONFLICT",
      409,
    );
  }

  if (!result.review) {
    throw new AppError(
      "Review could not be loaded after acknowledgement",
      "REVIEW_LOAD_FAILED",
      500,
    );
  }

  return {
    id: result.review.id,
    watchlistId: result.review.watchlistId,
    baselineReviewId:
      result.review.baselineReviewId,
    snapshotAt: result.review.snapshotAt,
    status: result.review.status,
    version: result.review.version,
    acknowledgedAt:
      result.review.acknowledgedAt,

    items: result.review.items.map((item) => ({
      id: item.id,

      instrument: {
        id: item.instrument.id,
        symbol: item.instrument.symbol,
        name: item.instrument.name,
        exchange: item.instrument.exchange,
        currency: item.instrument.currency,
      },

      price: item.price?.toString() ?? null,

      previousClose:
        item.previousClose?.toString() ?? null,

      volume: item.volume?.toString() ?? null,

      quoteQuality: item.quoteQuality,

      quoteSource:
  item.quoteSource,

marketSession: item.marketSession,

freshnessStatus:
  item.freshnessStatus,

quoteAgeSeconds:
  item.quoteAgeSeconds,

providerTimestamp:
  item.providerTimestamp,
    })),
  };
    },
    
    async getMeaningfulChanges(
  reviewId: string,
  watchlistId: string,
  userId: string,
) {
  const review =
    await reviewRepository.findWithBaseline(
      reviewId,
      watchlistId,
      userId,
    );
      

  if (!review) {
    throw new AppError(
      "Review not found",
      "REVIEW_NOT_FOUND",
      404,
    );
  }
      
      const policy = getChangeDetectionPolicy(
  review.policyVersion,
);


  if (!review.baselineReview) {
    return {
      reviewId: review.id,
      baselineReviewId: null,
      snapshotAt: review.snapshotAt,
      baselineSnapshotAt: null,
      policy: {
      version: policy.version,
      displayName: policy.displayName,
      priceThresholds:
        policy.priceThresholds,
    },
      summary: {
        high: 0,
        medium: 0,
        low: 0,
        none: 0,
        unavailable: review.items.length,
        total: review.items.length,
      },
      changes: [],
      message:
        "This is the first review, so there is no earlier acknowledged snapshot to compare against.",
    };
  }

  const baselineItems = new Map(
    review.baselineReview.items.map(
      (item) => [item.instrumentId, item],
    ),
  );

  const changes = review.items
    .map((item) => {
      const baselineItem =
        baselineItems.get(item.instrumentId) ??
        null;

      const change =
        calculateMeaningfulChange(
          {
            price:
              item.price?.toNumber() ?? null,
            previousClose:
              item.previousClose?.toNumber() ?? null,
            volume: item.volume,
            quoteQuality:
              item.quoteQuality,
            quoteSource:
              item.quoteSource,
            freshnessStatus:
  item.freshnessStatus,

quoteAgeSeconds:
  item.quoteAgeSeconds,
            customThresholdPercent:
              item.customThresholdPercent?.toNumber() ?? null,
            marketSession: item.marketSession,
            referenceSampleCount: item.referenceSampleCount,
            referenceVolatilityPercent:
              item.referenceVolatilityPercent?.toNumber() ?? null,
            referenceHigh: item.referenceHigh?.toNumber() ?? null,
            referenceLow: item.referenceLow?.toNumber() ?? null,
            referenceMedianVolume: item.referenceMedianVolume,
            referenceVolumeSampleCount:
              item.referenceVolumeSampleCount,
            referenceHorizonSessions:
              item.referenceHorizonSessions,
            referenceSource:
              item.referenceSource,
            referencePriceBasis:
              item.referencePriceBasis,
          },
          baselineItem
            ? {
                price:
                  baselineItem.price?.toNumber() ??
                  null,
                previousClose:
                  baselineItem.previousClose?.toNumber() ?? null,
                volume: baselineItem.volume,
                quoteQuality:
                baselineItem.quoteQuality,
                quoteSource:
                  baselineItem.quoteSource,
                freshnessStatus:
  baselineItem.freshnessStatus,

quoteAgeSeconds:
  baselineItem.quoteAgeSeconds,
                customThresholdPercent:
                  baselineItem.customThresholdPercent?.toNumber() ?? null,
              }
            : null,
          policy, 
        );

      return {
        instrument: item.instrument,

        current: {
  price:
    item.price?.toString() ?? null,
  volume:
    item.volume?.toString() ?? null,
  quoteQuality:
            item.quoteQuality,
  quoteSource:
  item.quoteSource,
  marketSession:
    item.marketSession,
  freshnessStatus:
    item.freshnessStatus,
  quoteAgeSeconds:
    item.quoteAgeSeconds,
  providerTimestamp:
            item.providerTimestamp,
  referenceContext: {
    sampleCount: item.referenceSampleCount,
    volatilityPercent:
      item.referenceVolatilityPercent?.toString() ?? null,
    recentHigh: item.referenceHigh?.toString() ?? null,
    recentLow: item.referenceLow?.toString() ?? null,
    medianDailyVolume:
      item.referenceMedianVolume?.toString() ?? null,
    volumeSampleCount: item.referenceVolumeSampleCount,
    horizonSessions: item.referenceHorizonSessions,
    source: item.referenceSource,
    priceBasis: item.referencePriceBasis,
  },
  
},

        baseline: baselineItem
  ? {
      price:
        baselineItem.price?.toString() ??
        null,
      volume:
        baselineItem.volume?.toString() ??
        null,
      quoteQuality:
              baselineItem.quoteQuality,
      quoteSource:
  baselineItem.quoteSource,
      marketSession:
        baselineItem.marketSession,
      freshnessStatus:
        baselineItem.freshnessStatus,
      quoteAgeSeconds:
        baselineItem.quoteAgeSeconds,
      providerTimestamp:
        baselineItem.providerTimestamp,
    }
  : null,

        ...change,
      };
    })
    .sort((left, right) => {
      const attentionDifference =
        getAttentionRank(
          right.attentionLevel,
        ) -
        getAttentionRank(
          left.attentionLevel,
        );

      if (attentionDifference !== 0) {
        return attentionDifference;
      }

      return right.score - left.score;
    });

  const summary = {
    high: changes.filter(
      (item) =>
        item.attentionLevel === "HIGH",
    ).length,

    medium: changes.filter(
      (item) =>
        item.attentionLevel === "MEDIUM",
    ).length,

    low: changes.filter(
      (item) =>
        item.attentionLevel === "LOW",
    ).length,

    none: changes.filter(
  (item) =>
    item.attentionLevel === "NONE" &&
    item.dataStatus !== "UNAVAILABLE",
).length,

unavailable: changes.filter(
  (item) => item.dataStatus === "UNAVAILABLE",
).length,

total: changes.length,
  };

  return {
    reviewId: review.id,
    baselineReviewId:
      review.baselineReview.id,
    snapshotAt: review.snapshotAt,
    baselineSnapshotAt:
      review.baselineReview.snapshotAt,
    summary,
    policy: {
    version: policy.version,
    displayName: policy.displayName,
    priceThresholds:
      policy.priceThresholds,
  },
    changes,
  };
},
};
