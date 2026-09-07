import assert from "node:assert/strict";
import { test } from "node:test";

import { normalizeYahooDailyBars } from "../src/modules/market-data/normalize-yahoo-daily-bars";
import { yahooDailyHistorySymbol } from "../src/infrastructure/providers/yahoo-daily-price-history-provider";

const day = (date: number) => Math.floor(Date.UTC(2026, 8, date, 4) / 1_000);

test("daily history translates identifiers imported from other providers", () => {
  assert.equal(yahooDailyHistorySymbol({
    id: "1", symbol: "INFY", exchange: "NSE", timezone: "Asia/Kolkata",
    providerIdentifier: "INFY:NSE",
  }), "INFY.NS");
  assert.equal(yahooDailyHistorySymbol({
    id: "2", symbol: "TCS", exchange: "BSE", timezone: "Asia/Kolkata",
    providerIdentifier: "TCS.BO",
  }), "TCS.BO");
});

test("daily history retains valid completed candles with provenance", () => {
  const bars = normalizeYahooDailyBars({
    instrumentId: "instrument-1",
    timezone: "Asia/Kolkata",
    now: new Date("2026-09-06T08:00:00.000Z"),
    receivedAt: new Date("2026-09-06T08:01:00.000Z"),
    arrays: {
      timestamps: [day(4), day(5)],
      open: [100, 105], high: [110, 112], low: [95, 101], close: [108, 111],
      volume: [1_000, 2_000], adjustedClose: [107.5, 111],
    },
  });

  assert.equal(bars.length, 2);
  assert.equal(bars[0]?.tradingDate.toISOString(), "2026-09-04T00:00:00.000Z");
  assert.equal(bars[0]?.source, "yahoo-finance-unofficial");
  assert.equal(bars[0]?.adjustment, "RAW_WITH_ADJUSTED_CLOSE");
  assert.equal(bars[0]?.volume, BigInt(1_000));
});

test("daily history excludes the current unfinished exchange date", () => {
  const bars = normalizeYahooDailyBars({
    instrumentId: "instrument-1", timezone: "Asia/Kolkata",
    now: new Date("2026-09-06T08:00:00.000Z"), receivedAt: new Date(),
    arrays: {
      timestamps: [day(5), day(6)], open: [100, 101], high: [105, 106],
      low: [99, 100], close: [104, 105], volume: [100, 200],
    },
  });

  assert.equal(bars.length, 1);
  assert.equal(bars[0]?.tradingDate.toISOString(), "2026-09-05T00:00:00.000Z");
});

test("daily history rejects missing, contradictory, and unsafe candles", () => {
  const bars = normalizeYahooDailyBars({
    instrumentId: "instrument-1", timezone: "Asia/Kolkata",
    now: new Date("2026-09-10T08:00:00.000Z"), receivedAt: new Date(),
    arrays: {
      timestamps: [day(4), day(5), day(6)], open: [100, null, 100],
      high: [99, 110, 110], low: [90, 90, 90], close: [98, 105, 105],
      volume: [100, 100, Number.MAX_SAFE_INTEGER + 1],
    },
  });

  assert.deepEqual(bars, []);
});

test("a corrected candle replaces an earlier value for the same trading date", () => {
  const timestamp = day(4);
  const bars = normalizeYahooDailyBars({
    instrumentId: "instrument-1", timezone: "Asia/Kolkata",
    now: new Date("2026-09-06T08:00:00.000Z"), receivedAt: new Date(),
    arrays: {
      timestamps: [timestamp, timestamp + 60], open: [100, 100],
      high: [105, 106], low: [95, 95], close: [102, 103], volume: [100, 110],
    },
  });

  assert.equal(bars.length, 1);
  assert.equal(bars[0]?.close, "103");
  assert.equal(bars[0]?.volume, BigInt(110));
});
