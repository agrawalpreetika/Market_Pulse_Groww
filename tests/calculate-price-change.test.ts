import assert from "node:assert/strict";
import { test } from "node:test";

import { calculatePriceChange } from "../src/modules/market-data/calculate-price-change";

test("today's price change is unavailable without a valid previous close", () => {
  assert.equal(calculatePriceChange("100", null), null);
  assert.equal(calculatePriceChange("100", "0"), null);
});

test("today's price change preserves direction and percentage", () => {
  assert.deepEqual(calculatePriceChange("95", "100"), {
    absolute: "-5.00",
    percent: "-5.00",
  });
});
