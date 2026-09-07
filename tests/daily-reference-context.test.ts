import assert from "node:assert/strict";
import { test } from "node:test";

import { buildDailyReferenceContext } from "../src/modules/change-detection/build-daily-reference-context";

function bar(day: number, close: number, adjustedClose: number | null = close) {
  return {
    tradingDate: new Date(Date.UTC(2026, 7, day)),
    open: close - 0.5,
    high: close + 1,
    low: close - 1,
    close,
    adjustedClose,
    volume: BigInt(day * 1_000),
    source: "yahoo-finance-unofficial",
  };
}

test("daily reference freezes adjusted volatility and review horizon", () => {
  const bars = Array.from({ length: 20 }, (_, index) =>
    bar(index + 1, 100 + index + (index % 2 === 0 ? 0.5 : -0.5)),
  );
  const result = buildDailyReferenceContext({
    bars,
    currentSource: "yahoo-finance-unofficial",
    currentTimestamp: new Date("2026-08-21T06:00:00.000Z"),
    baselineTimestamp: new Date("2026-08-17T06:00:00.000Z"),
    timezone: "Asia/Kolkata",
  });

  assert.equal(result.sampleCount, 20);
  assert.equal(result.horizonSessions, 3);
  assert.ok(result.volatilityPercent !== null && result.volatilityPercent > 0);
  assert.equal(result.priceBasis, "ADJUSTED_CLOSE");
  assert.equal(result.source, "yahoo-finance-unofficial");
  assert.equal(result.recentHigh, 119.5);
  assert.equal(result.recentLow, 99.5);
  assert.equal(result.volumeSampleCount, 20);
});

test("daily reference rejects incompatible providers", () => {
  const result = buildDailyReferenceContext({
    bars: [bar(1, 100)],
    currentSource: "licensed-provider",
    currentTimestamp: new Date("2026-08-21T06:00:00.000Z"),
    baselineTimestamp: new Date("2026-08-17T06:00:00.000Z"),
    timezone: "Asia/Kolkata",
  });

  assert.equal(result.sampleCount, 0);
  assert.equal(result.source, null);
});

test("daily reference withholds raw breakout range across an adjustment discontinuity", () => {
  const bars = Array.from({ length: 12 }, (_, index) =>
    bar(index + 1, 100 + index, index < 6 ? (100 + index) / 2 : 100 + index),
  );
  const result = buildDailyReferenceContext({
    bars,
    currentSource: "yahoo-finance-unofficial",
    currentTimestamp: new Date("2026-08-20T06:00:00.000Z"),
    baselineTimestamp: new Date("2026-08-15T06:00:00.000Z"),
    timezone: "Asia/Kolkata",
  });

  assert.equal(result.priceBasis, "ADJUSTED_CLOSE");
  assert.equal(result.recentHigh, null);
  assert.equal(result.recentLow, null);
});

test("daily reference declines horizon volatility when history starts after the baseline", () => {
  const bars = Array.from({ length: 12 }, (_, index) => bar(index + 10, 100 + index));
  const result = buildDailyReferenceContext({
    bars,
    currentSource: "yahoo-finance-unofficial",
    currentTimestamp: new Date("2026-08-25T06:00:00.000Z"),
    baselineTimestamp: new Date("2026-08-01T06:00:00.000Z"),
    timezone: "Asia/Kolkata",
  });

  assert.equal(result.horizonSessions, 0);
  assert.equal(result.volatilityPercent, null);
});
