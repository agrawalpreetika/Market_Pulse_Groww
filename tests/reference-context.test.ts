import assert from "node:assert/strict";
import { test } from "node:test";

import { buildReferenceContext } from "../src/modules/change-detection/build-reference-context";

function observation(day: number, price: number, overrides: Partial<{
  source: string;
  volume: bigint | null;
  hour: number;
}> = {}) {
  return {
    price,
    high: price + 1,
    low: price - 1,
    volume: overrides.volume ?? BigInt(day * 1_000),
    source: overrides.source ?? "yahoo-finance-unofficial",
    providerTimestamp: new Date(Date.UTC(2026, 7, day, overrides.hour ?? 10)),
  };
}

test("reference context keeps one final observation per prior trading date", () => {
  const observations = [];
  for (let day = 1; day <= 12; day += 1) {
    observations.push(observation(day, 100 + day, { hour: 8 }));
    observations.push(observation(day, 101 + day, { hour: 10 }));
  }

  const result = buildReferenceContext({
    observations,
    currentSource: "yahoo-finance-unofficial",
    currentTimestamp: new Date(Date.UTC(2026, 7, 13, 10)),
  });

  assert.equal(result.sampleCount, 12);
  assert.ok(result.volatilityPercent !== null);
  assert.equal(result.recentHigh, 114);
  assert.equal(result.recentLow, 101);
  assert.equal(result.volumeSampleCount, 12);
  assert.equal(result.medianDailyVolume, BigInt(6_500));
});

test("reference context excludes the current date and incompatible providers", () => {
  const result = buildReferenceContext({
    observations: [
      observation(1, 100),
      observation(2, 500, { source: "another-provider" }),
      observation(3, 900),
    ],
    currentSource: "yahoo-finance-unofficial",
    currentTimestamp: new Date(Date.UTC(2026, 7, 3, 10)),
  });

  assert.equal(result.sampleCount, 1);
  assert.equal(result.volatilityPercent, null);
  assert.equal(result.recentHigh, null);
  assert.equal(result.medianDailyVolume, null);
});
