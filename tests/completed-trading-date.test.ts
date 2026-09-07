import assert from "node:assert/strict";
import { test } from "node:test";

import { getLatestCompletedTradingDate } from "../src/modules/market-data/completed-trading-date";

test("daily history targets the previous weekday before the close buffer", () => {
  assert.equal(
    getLatestCompletedTradingDate(
      new Date("2026-09-07T09:00:00.000Z"),
    ).toISOString(),
    "2026-09-04T00:00:00.000Z",
  );
});

test("daily history targets today after the close buffer", () => {
  assert.equal(
    getLatestCompletedTradingDate(
      new Date("2026-09-07T10:30:00.000Z"),
    ).toISOString(),
    "2026-09-07T00:00:00.000Z",
  );
});

test("daily history targets Friday throughout the weekend", () => {
  assert.equal(
    getLatestCompletedTradingDate(
      new Date("2026-09-06T08:00:00.000Z"),
    ).toISOString(),
    "2026-09-04T00:00:00.000Z",
  );
});
