import assert from "node:assert/strict";
import { test } from "node:test";

import { getIndianMarketState } from "../src/modules/market-data/indian-market-hours";

test("market is closed during the weekend", () => {
  const result = getIndianMarketState(
    new Date("2026-09-06T06:30:00.000Z"),
  );

  assert.deepEqual(result, {
    state: "WEEKEND",
    shouldRefresh: false,
  });
});

test("market is closed before 9:15 IST", () => {
  const result = getIndianMarketState(
    new Date("2026-09-07T03:30:00.000Z"),
  );

  assert.deepEqual(result, {
    state: "BEFORE_OPEN",
    shouldRefresh: false,
  });
});

test("market opens at 9:15 IST", () => {
  const result = getIndianMarketState(
    new Date("2026-09-07T03:45:00.000Z"),
  );

  assert.deepEqual(result, {
    state: "OPEN",
    shouldRefresh: true,
  });
});

test("market is open during regular trading", () => {
  const result = getIndianMarketState(
    new Date("2026-09-07T04:00:00.000Z"),
  );

  assert.deepEqual(result, {
    state: "OPEN",
    shouldRefresh: true,
  });
});

test("market closes at 15:30 IST", () => {
  const result = getIndianMarketState(
    new Date("2026-09-07T10:00:00.000Z"),
  );

  assert.deepEqual(result, {
    state: "AFTER_CLOSE",
    shouldRefresh: false,
  });
});