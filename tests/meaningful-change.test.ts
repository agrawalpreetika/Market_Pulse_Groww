import assert from "node:assert/strict";
import { test } from "node:test";

import {
  calculateMeaningfulChange as calculateMeaningfulChangeWithPolicy,
  getAttentionRank,
} from "../src/modules/reviews/calculate-meaningful-change";

import type {
  SnapshotForComparison,
} from "../src/modules/reviews/calculate-meaningful-change";

import {
  getChangeDetectionPolicy,
} from "../src/modules/change-detection/change-detection-policy";

import type {
  ChangeDetectionPolicy,
} from "../src/modules/change-detection/change-detection-policy";

const policy =
  getChangeDetectionPolicy("historical-context-v3");

test("v4 declines unsupported volatility and full-day volume even with legacy context", () => {
  const result = calculateMeaningfulChangeWithPolicy(snapshot({
    price: 102, marketSession: "CLOSED", volume: BigInt(100000),
    referenceSampleCount: 30, referenceVolatilityPercent: 0.25,
    referenceMedianVolume: BigInt(1000), referenceVolumeSampleCount: 30,
  }), snapshot(), getChangeDetectionPolicy("observed-context-v4"));
  assert.equal(result.attentionLevel, "MEDIUM");
  assert.equal(result.volatilityMultiple, null);
  assert.equal(result.volumeMultiple, null);
  assert.equal(result.dataStatus, "LIMITED");
});

test("v5 uses review-horizon volatility from completed daily history", () => {
  const result = calculateMeaningfulChangeWithPolicy(
    snapshot({
      price: 102,
      referenceSampleCount: 30,
      referenceVolatilityPercent: 0.5,
      referenceHorizonSessions: 4,
      referenceSource: "test-provider",
      referencePriceBasis: "ADJUSTED_CLOSE",
    }),
    snapshot(),
    getChangeDetectionPolicy("daily-context-v5"),
  );

  assert.equal(result.volatilityMultiple, 4);
  assert.equal(result.attentionLevel, "HIGH");
  assert.ok(result.signals.includes("VOLATILITY_ADJUSTED_MOVE"));
  assert.ok(result.reasons.some((reason) => reason.includes("review-period session")));
});

test("v5 exposes insufficient or unadjusted daily evidence", () => {
  const result = calculateMeaningfulChangeWithPolicy(
    snapshot({
      price: 102,
      referenceSampleCount: 5,
      referencePriceBasis: "NONE",
    }),
    snapshot(),
    getChangeDetectionPolicy("daily-context-v5"),
  );

  assert.equal(result.volatilityMultiple, null);
  assert.equal(result.dataStatus, "LIMITED");
  assert.ok(result.warnings.some((warning) => warning.includes("at least 10")));
  assert.ok(result.warnings.some((warning) => warning.includes("adjusted-close")));
});

function calculateMeaningfulChange(
  current: SnapshotForComparison,
  baseline: SnapshotForComparison | null,
  selectedPolicy: ChangeDetectionPolicy = policy,
) {
  return calculateMeaningfulChangeWithPolicy(
    current,
    baseline,
    selectedPolicy,
  );
}

function snapshot(
  overrides: Partial<SnapshotForComparison> = {},
): SnapshotForComparison {
  return {
    price: 100,
    volume: BigInt(1_000),
    quoteQuality: "LIVE",
    quoteSource: "test-provider",
    freshnessStatus: "FRESH",
    quoteAgeSeconds: 5,
    ...overrides,
  };
}

test("unchanged prices and volume produce no attention", () => {
  const result = calculateMeaningfulChange(
    snapshot(),
    snapshot(),
  );

  assert.equal(result.attentionLevel, "NONE");
  assert.equal(result.direction, "UNCHANGED");
  assert.equal(result.priceChangePercent, 0);
  assert.equal(result.volumeChangePercent, null);
  assert.equal(result.score, 0);
});

test("a movement below 1% stays below the price threshold", () => {
  const result = calculateMeaningfulChange(
    snapshot({ price: 100.5 }),
    snapshot(),
  );

  assert.equal(result.attentionLevel, "NONE");
  assert.equal(result.priceChangePercent, 0.5);
});

test("exact price thresholds are inclusive", () => {
  const cases = [
    { price: 101, expected: "LOW" },
    { price: 102, expected: "MEDIUM" },
    { price: 104, expected: "HIGH" },
  ] as const;

  for (const item of cases) {
    const result = calculateMeaningfulChange(
      snapshot({ price: item.price }),
      snapshot(),
    );

    assert.equal(
      result.attentionLevel,
      item.expected,
      `Unexpected attention for price ${item.price}`,
    );
  }
});

test("a downward movement retains its negative sign", () => {
  const result = calculateMeaningfulChange(
    snapshot({ price: 95 }),
    snapshot(),
  );

  assert.equal(result.attentionLevel, "HIGH");
  assert.equal(result.direction, "DOWN");
  assert.equal(result.priceChange, -5);
  assert.equal(result.priceChangePercent, -5);
});

test("a newly added instrument has no invented baseline", () => {
  const result = calculateMeaningfulChange(
    snapshot(),
    null,
  );

  assert.equal(result.attentionLevel, "NONE");
  assert.equal(result.dataStatus, "UNAVAILABLE");
  assert.equal(result.direction, "UNKNOWN");
  assert.equal(result.priceChange, null);
  assert.equal(result.priceChangePercent, null);
  assert.equal(result.volumeChangePercent, null);
});
test("missing current price is reported as unavailable", () => {
  const result = calculateMeaningfulChange(
    snapshot({ price: null }),
    snapshot(),
  );

  assert.equal(result.attentionLevel, "NONE");
  assert.equal(result.dataStatus, "UNAVAILABLE");
  assert.equal(result.direction, "UNKNOWN");
  assert.equal(result.priceChangePercent, null);

  assert.ok(
    result.warnings.includes(
      "Current price is unavailable or invalid",
    ),
  );
});

test("zero baseline values never produce infinite percentages", () => {
  const result = calculateMeaningfulChange(
    snapshot(),
    snapshot({
      price: 0,
      volume: BigInt(0),
    }),
  );

  assert.equal(result.priceChangePercent, null);
  assert.equal(result.volumeChangePercent, null);
  assert.ok(Number.isFinite(result.score));
});

test("missing volume does not prevent price comparison", () => {
  const result = calculateMeaningfulChange(
    snapshot({
      price: 104,
      volume: null,
    }),
    snapshot(),
  );

  assert.equal(result.attentionLevel, "HIGH");
  assert.equal(result.priceChangePercent, 4);
  assert.equal(result.volumeChangePercent, null);
});

test("conflicted data blocks the comparison", () => {
  const result = calculateMeaningfulChange(
    snapshot({ quoteQuality: "CONFLICTED" }),
    snapshot(),
  );

  assert.equal(result.attentionLevel, "NONE");
  assert.equal(result.dataStatus, "UNAVAILABLE");
  assert.equal(result.priceChangePercent, null);

  assert.ok(
    result.warnings.some((warning) =>
      warning.includes("conflicting"),
    ),
  );
});

test("the demo fixtures preserve the expected ranking", () => {
  const fixtures = [
    {
      symbol: "INFY",
      current: snapshot({
        price: 1605,
        volume: BigInt(4_500_000),
      }),
      baseline: snapshot({
        price: 1534.2,
        volume: BigInt(2_800_000),
      }),
    },
    {
      symbol: "TCS",
      current: snapshot({
        price: 3610,
        volume: BigInt(1_400_000),
      }),
      baseline: snapshot({
        price: 3625.5,
        volume: BigInt(1_350_000),
      }),
    },
    {
      symbol: "WIPRO",
      current: snapshot({
        price: 238.5,
        volume: BigInt(7_100_000),
      }),
      baseline: snapshot({
        price: 251.75,
        volume: BigInt(4_200_000),
      }),
    },
  ];

  const ranked = fixtures
    .map((item) => ({
      symbol: item.symbol,
      ...calculateMeaningfulChange(
        item.current,
        item.baseline,
      ),
    }))
    .sort(
      (left, right) =>
        getAttentionRank(right.attentionLevel) -
          getAttentionRank(left.attentionLevel) ||
        right.score - left.score,
    );

  assert.deepEqual(
    ranked.map((item) => item.symbol),
    ["WIPRO", "INFY", "TCS"],
  );

  assert.deepEqual(
    ranked.map((item) => item.attentionLevel),
    ["HIGH", "HIGH", "NONE"],
  );

  assert.equal(ranked[0].priceChangePercent, -5.26);
  assert.equal(ranked[1].priceChangePercent, 4.61);
  assert.equal(ranked[2].priceChangePercent, -0.43);
});

// These are known gaps, not passing guarantees.
// We will implement their behavior in the next reliability batch.

test("a missing baseline price reports insufficient data", () => {
  const result = calculateMeaningfulChange(
    snapshot(),
    snapshot({ price: null }),
  );

  assert.equal(result.attentionLevel, "NONE");
  assert.equal(result.dataStatus, "UNAVAILABLE");
  assert.equal(result.priceChangePercent, null);

  assert.ok(
    result.warnings.includes(
      "Baseline price is unavailable or invalid",
    ),
  );
});

test("raw cumulative volume does not influence attention", () => {
  const baseline = snapshot({
    volume: BigInt(1_000),
  });

  for (const volume of [
    BigInt(100),
    BigInt(100_000),
  ]) {
    const result = calculateMeaningfulChange(
      snapshot({ volume }),
      baseline,
    );

    assert.equal(result.attentionLevel, "NONE");
    assert.equal(result.score, 0);
    assert.equal(result.volumeChangePercent, null);
  }
});

test("an invalid baseline price cannot produce a percentage", () => {
  for (const price of [0, -100, Number.NaN]) {
    const result = calculateMeaningfulChange(
      snapshot(),
      snapshot({ price }),
    );

    assert.equal(result.attentionLevel, "NONE");
    assert.equal(result.dataStatus, "UNAVAILABLE");
    assert.equal(result.priceChange, null);
    assert.equal(result.priceChangePercent, null);
    assert.ok(Number.isFinite(result.score));
  }
});

test("invalid current prices never produce movement claims", () => {
  for (const price of [
    0,
    -1,
    Number.NaN,
    Number.POSITIVE_INFINITY,
  ]) {
    const result = calculateMeaningfulChange(
      snapshot({ price }),
      snapshot(),
    );

    assert.equal(result.dataStatus, "UNAVAILABLE");
    assert.equal(result.attentionLevel, "NONE");
    assert.equal(result.priceChange, null);
    assert.equal(result.priceChangePercent, null);
    assert.equal(result.direction, "UNKNOWN");
  }
});

test("delayed data retains its comparison with a limitation", () => {
  const result = calculateMeaningfulChange(
    snapshot({
      price: 104,
      quoteQuality: "DELAYED",
    }),
    snapshot(),
  );

  assert.equal(result.attentionLevel, "HIGH");
  assert.equal(result.priceChangePercent, 4);
  assert.equal(result.dataStatus, "LIMITED");
  assert.ok(result.warnings.length > 0);
});

test("policy thresholds control classification", () => {
  const customPolicy: ChangeDetectionPolicy = {
    ...policy,
    version: "test-policy",
    priceThresholds: {
      lowPercent: 5,
      mediumPercent: 10,
      highPercent: 20,
    },
  };

  const result = calculateMeaningfulChange(
    snapshot({ price: 104 }),
    snapshot(),
    customPolicy,
  );

  assert.equal(result.attentionLevel, "NONE");
  assert.equal(result.priceChangePercent, 4);
});

test("a stale captured quote blocks movement classification", () => {
  const result = calculateMeaningfulChange(
    snapshot({
      price: 110,
      freshnessStatus: "STALE",
      quoteAgeSeconds: 900,
    }),
    snapshot(),
  );

  assert.equal(result.attentionLevel, "NONE");
  assert.equal(result.dataStatus, "UNAVAILABLE");
  assert.equal(result.priceChangePercent, null);

  assert.ok(
    result.warnings.some((warning) =>
      warning.includes("stale when captured"),
    ),
  );
});

test("an aging captured quote keeps comparison with a warning", () => {
  const result = calculateMeaningfulChange(
    snapshot({
      price: 104,
      freshnessStatus: "AGING",
      quoteAgeSeconds: 120,
    }),
    snapshot(),
  );

  assert.equal(result.attentionLevel, "HIGH");
  assert.equal(result.dataStatus, "LIMITED");
  assert.equal(result.priceChangePercent, 4);
});

test("market-closed freshness does not make valid data stale", () => {
  const result = calculateMeaningfulChange(
    snapshot({
      price: 104,
      freshnessStatus: "MARKET_CLOSED",
      quoteAgeSeconds: 50_000,
    }),
    snapshot({
      freshnessStatus: "MARKET_CLOSED",
      quoteAgeSeconds: 50_000,
    }),
  );

  assert.equal(result.attentionLevel, "HIGH");
  assert.equal(result.dataStatus, "AVAILABLE");
  assert.equal(result.priceChangePercent, 4);
  assert.equal(result.warnings.length, 0);
});

test("legacy unknown freshness is visible as a limitation", () => {
  const result = calculateMeaningfulChange(
    snapshot({
      price: 104,
      freshnessStatus: "UNKNOWN",
      quoteAgeSeconds: null,
    }),
    snapshot({
      freshnessStatus: "UNKNOWN",
      quoteAgeSeconds: null,
    }),
  );

  assert.equal(result.attentionLevel, "HIGH");
  assert.equal(result.dataStatus, "LIMITED");

  assert.ok(
    result.warnings.some((warning) =>
      warning.includes("freshness is unknown"),
    ),
  );
});

test("matching delayed quality and freshness produce one warning", () => {
  const result = calculateMeaningfulChange(
    snapshot({
      price: 104,
      quoteQuality: "DELAYED",
      freshnessStatus: "DELAYED",
    }),
    snapshot(),
  );

  assert.deepEqual(result.warnings, [
    "Current quote was delayed when captured",
  ]);

  assert.equal(
    result.dataStatus,
    "LIMITED",
  );
});

test("different real providers cannot produce a market movement", () => {
  const result = calculateMeaningfulChange(
    snapshot({
      price: 95,
      quoteSource: "yahoo-finance-unofficial",
    }),
    snapshot({
      price: 100,
      quoteSource: "mock-baseline",
    }),
  );

  assert.equal(result.attentionLevel, "NONE");
  assert.equal(result.dataStatus, "UNAVAILABLE");
  assert.equal(result.direction, "UNKNOWN");
  assert.equal(result.priceChange, null);
  assert.equal(result.priceChangePercent, null);
  assert.ok(
    result.warnings.some((warning) =>
      warning.includes("not comparable"),
    ),
  );
});

test("legacy snapshots without source provenance are not assessed", () => {
  const result = calculateMeaningfulChange(
    snapshot({
      price: 104,
      quoteSource: "yahoo-finance-unofficial",
    }),
    snapshot({ quoteSource: null }),
  );

  assert.equal(result.attentionLevel, "NONE");
  assert.equal(result.dataStatus, "UNAVAILABLE");
  assert.equal(result.priceChangePercent, null);
  assert.ok(
    result.warnings.includes(
      "Quote sources cannot be verified for both snapshots",
    ),
  );
});

test("different mock scenarios remain comparable within the mock family", () => {
  const result = calculateMeaningfulChange(
    snapshot({
      price: 104,
      quoteSource: "mock-moved",
    }),
    snapshot({ quoteSource: "mock-baseline" }),
  );

  assert.equal(result.attentionLevel, "HIGH");
  assert.equal(result.dataStatus, "AVAILABLE");
  assert.equal(result.priceChangePercent, 4);
});


test("market closed takes display priority over delayed quality", () => {
  const result = calculateMeaningfulChange(
    snapshot({
      price: 104,
      quoteQuality: "DELAYED",
      freshnessStatus: "MARKET_CLOSED",
      quoteAgeSeconds: 50_000,
    }),
    snapshot({
      quoteQuality: "DELAYED",
      freshnessStatus: "MARKET_CLOSED",
      quoteAgeSeconds: 50_000,
    }),
  );

  assert.equal(result.attentionLevel, "HIGH");
  assert.equal(result.dataStatus, "LIMITED");
  assert.equal(result.priceChangePercent, 4);

  assert.deepEqual(result.warnings, [
    "Current quote was marked delayed",
    "Baseline quote was marked delayed",
  ]);
});

test("v2 applies a frozen custom threshold without changing v1", () => {
  const v2Result = calculateMeaningfulChange(
    snapshot({ price: 102, customThresholdPercent: 3 }),
    snapshot(),
  );
  const v1Result = calculateMeaningfulChange(
    snapshot({ price: 102, customThresholdPercent: 3 }),
    snapshot(),
    getChangeDetectionPolicy("price-movement-v1"),
  );

  assert.equal(v2Result.attentionLevel, "NONE");
  assert.deepEqual(v2Result.appliedThresholds, {
    lowPercent: 3,
    mediumPercent: 6,
    highPercent: 12,
  });
  assert.equal(v1Result.attentionLevel, "MEDIUM");
});

test("v2 identifies a material current-session reversal", () => {
  const result = calculateMeaningfulChange(
    snapshot({ price: 104, previousClose: 106 }),
    snapshot({ price: 100 }),
  );

  assert.equal(result.attentionLevel, "HIGH");
  assert.equal(result.confidence, "HIGH");
  assert.ok(result.signals.includes("SESSION_DIRECTION_REVERSAL"));
  assert.ok(result.reasons.some((reason) => reason.includes("reversed")));
});

test("warnings reduce confidence without discarding a valid comparison", () => {
  const result = calculateMeaningfulChange(
    snapshot({ price: 104, quoteQuality: "DELAYED" }),
    snapshot(),
  );

  assert.equal(result.dataStatus, "LIMITED");
  assert.equal(result.confidence, "MEDIUM");
});

test("v3 detects a volatility-adjusted move with sufficient history", () => {
  const result = calculateMeaningfulChange(
    snapshot({
      price: 102,
      referenceSampleCount: 20,
      referenceVolatilityPercent: 0.5,
      referenceHigh: 105,
      referenceLow: 95,
    }),
    snapshot({ price: 100 }),
  );

  assert.equal(result.attentionLevel, "HIGH");
  assert.equal(result.volatilityMultiple, 4);
  assert.ok(result.signals.includes("VOLATILITY_ADJUSTED_MOVE"));
});

test("v3 detects a recent-range breakout", () => {
  const result = calculateMeaningfulChange(
    snapshot({
      price: 102,
      referenceSampleCount: 20,
      referenceHigh: 101,
      referenceLow: 90,
    }),
    snapshot({ price: 100 }),
  );

  assert.equal(result.rangeBreakout, "UP");
  assert.equal(result.attentionLevel, "MEDIUM");
  assert.ok(result.signals.includes("RECENT_RANGE_BREAKOUT"));
});

test("v3 uses volume only for a completed session with enough history", () => {
  const closed = calculateMeaningfulChange(
    snapshot({
      price: 102,
      volume: BigInt(3_000),
      marketSession: "CLOSED",
      referenceMedianVolume: BigInt(1_000),
      referenceVolumeSampleCount: 10,
    }),
    snapshot({ price: 100 }),
  );
  const live = calculateMeaningfulChange(
    snapshot({
      price: 102,
      volume: BigInt(3_000),
      marketSession: "REGULAR",
      referenceMedianVolume: BigInt(1_000),
      referenceVolumeSampleCount: 10,
    }),
    snapshot({ price: 100 }),
  );

  assert.equal(closed.volumeMultiple, 3);
  assert.ok(closed.signals.includes("ABNORMAL_CLOSED_SESSION_VOLUME"));
  assert.equal(live.volumeMultiple, null);
  assert.ok(!live.signals.includes("ABNORMAL_CLOSED_SESSION_VOLUME"));
});
