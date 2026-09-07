import type { ProviderDailyPriceBar } from "./daily-price-history.types";

export type YahooDailyBarArrays = {
  timestamps: number[];
  open?: Array<number | null>;
  high?: Array<number | null>;
  low?: Array<number | null>;
  close?: Array<number | null>;
  volume?: Array<number | null>;
  adjustedClose?: Array<number | null>;
};

function marketDate(timestamp: Date, timezone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(timestamp);

  const value = (type: "year" | "month" | "day") =>
    parts.find((part) => part.type === type)?.value;

  return `${value("year")}-${value("month")}-${value("day")}`;
}

function dateOnly(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

function isPositive(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

export function normalizeYahooDailyBars(input: {
  instrumentId: string;
  timezone: string;
  now: Date;
  receivedAt: Date;
  arrays: YahooDailyBarArrays;
}): ProviderDailyPriceBar[] {
  const today = marketDate(input.now, input.timezone);
  const bars = new Map<string, ProviderDailyPriceBar>();

  input.arrays.timestamps.forEach((timestampSeconds, index) => {
    if (!Number.isInteger(timestampSeconds) || timestampSeconds <= 0) return;

    const providerTimestamp = new Date(timestampSeconds * 1_000);
    if (Number.isNaN(providerTimestamp.getTime())) return;

    const tradingDateText = marketDate(providerTimestamp, input.timezone);

    // A provider may expose today's still-forming candle. Only earlier exchange
    // dates qualify as completed sessions.
    if (tradingDateText >= today) return;

    const open = input.arrays.open?.[index];
    const high = input.arrays.high?.[index];
    const low = input.arrays.low?.[index];
    const close = input.arrays.close?.[index];
    const volume = input.arrays.volume?.[index];
    const adjustedClose = input.arrays.adjustedClose?.[index];

    if (
      !isPositive(open) ||
      !isPositive(high) ||
      !isPositive(low) ||
      !isPositive(close) ||
      typeof volume !== "number" ||
      !Number.isSafeInteger(volume) ||
      volume < 0 ||
      high < Math.max(open, close) ||
      low > Math.min(open, close) ||
      low > high
    ) {
      return;
    }

    const usableAdjustedClose = isPositive(adjustedClose)
      ? adjustedClose
      : null;

    bars.set(tradingDateText, {
      instrumentId: input.instrumentId,
      tradingDate: dateOnly(tradingDateText),
      open: open.toString(),
      high: high.toString(),
      low: low.toString(),
      close: close.toString(),
      adjustedClose: usableAdjustedClose?.toString() ?? null,
      volume: BigInt(volume),
      adjustment: usableAdjustedClose === null
        ? "RAW"
        : "RAW_WITH_ADJUSTED_CLOSE",
      source: "yahoo-finance-unofficial",
      providerTimestamp,
      receivedAt: input.receivedAt,
    });
  });

  return [...bars.values()].sort(
    (left, right) => left.tradingDate.getTime() - right.tradingDate.getTime(),
  );
}
