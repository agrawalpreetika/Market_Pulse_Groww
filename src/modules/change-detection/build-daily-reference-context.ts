type DailyReferenceBar = {
  tradingDate: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  adjustedClose: number | null;
  volume: bigint;
  source: string;
};

export type DailyReferenceContext = {
  sampleCount: number;
  horizonSessions: number;
  volatilityPercent: number | null;
  recentHigh: number | null;
  recentLow: number | null;
  medianDailyVolume: bigint | null;
  volumeSampleCount: number;
  source: string | null;
  priceBasis: "NONE" | "ADJUSTED_CLOSE";
};

function sourceFamily(source: string): string {
  return source.startsWith("mock-") ? "mock" : source;
}

function exchangeDate(date: Date, timezone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const value = (type: "year" | "month" | "day") =>
    parts.find((part) => part.type === type)?.value;
  return `${value("year")}-${value("month")}-${value("day")}`;
}

function storedTradingDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function median(values: bigint[]): bigint | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((left, right) =>
    left < right ? -1 : left > right ? 1 : 0,
  );
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / BigInt(2);
}

function sampleStandardDeviation(values: number[]): number | null {
  if (values.length < 10) return null;
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance = values.reduce(
    (sum, value) => sum + (value - mean) ** 2,
    0,
  ) / (values.length - 1);
  const result = Math.sqrt(variance);
  return Number.isFinite(result) ? result : null;
}

export function buildDailyReferenceContext(input: {
  bars: DailyReferenceBar[];
  currentSource: string | null;
  currentTimestamp: Date | null;
  baselineTimestamp: Date | null;
  timezone: string;
  maximumReferenceSessions?: number;
}): DailyReferenceContext {
  const empty: DailyReferenceContext = {
    sampleCount: 0,
    horizonSessions: 0,
    volatilityPercent: null,
    recentHigh: null,
    recentLow: null,
    medianDailyVolume: null,
    volumeSampleCount: 0,
    source: null,
    priceBasis: "NONE",
  };

  if (!input.currentSource || !input.currentTimestamp) return empty;

  const family = sourceFamily(input.currentSource);
  const currentDate = exchangeDate(input.currentTimestamp, input.timezone);
  const eligible = input.bars
    .filter((bar) =>
      sourceFamily(bar.source) === family &&
      storedTradingDate(bar.tradingDate) < currentDate &&
      [bar.open, bar.high, bar.low, bar.close].every(
        (value) => Number.isFinite(value) && value > 0,
      ) &&
      bar.low <= Math.min(bar.open, bar.close) &&
      bar.high >= Math.max(bar.open, bar.close) &&
      bar.low <= bar.high &&
      bar.volume >= 0
    )
    .sort((left, right) => left.tradingDate.getTime() - right.tradingDate.getTime());

  if (eligible.length === 0) return empty;

  const reference = eligible.slice(-(input.maximumReferenceSessions ?? 30));
  const adjustedCoverage = reference.every(
    (bar) => bar.adjustedClose !== null && Number.isFinite(bar.adjustedClose) && bar.adjustedClose > 0,
  );
  const adjustedReturns: number[] = [];

  if (adjustedCoverage) {
    for (let index = 1; index < reference.length; index += 1) {
      const previous = reference[index - 1].adjustedClose as number;
      const current = reference[index].adjustedClose as number;
      const change = ((current - previous) / previous) * 100;
      if (Number.isFinite(change)) adjustedReturns.push(change);
    }
  }

  const dailyVolatility = sampleStandardDeviation(adjustedReturns);
  const baselineDate = input.baselineTimestamp
    ? exchangeDate(input.baselineTimestamp, input.timezone)
    : null;
  const earliestAvailableDate = storedTradingDate(eligible[0].tradingDate);
  const horizonCoverageComplete = baselineDate !== null && baselineDate >= earliestAvailableDate;
  const completedSinceBaseline = horizonCoverageComplete
    ? eligible.filter((bar) => storedTradingDate(bar.tradingDate) > baselineDate).length
    : 0;
  const horizonSessions = horizonCoverageComplete ? Math.max(1, completedSinceBaseline) : 0;
  const volatilityPercent = dailyVolatility !== null && horizonSessions > 0
    ? Number((dailyVolatility * Math.sqrt(horizonSessions)).toFixed(4))
    : null;

  // A changing adjusted/raw ratio is evidence of a corporate action or other
  // discontinuity. In that case raw highs/lows are not a comparable range.
  const adjustmentFactors = adjustedCoverage
    ? reference.map((bar) => (bar.adjustedClose as number) / bar.close)
    : [];
  const factorSpread = adjustmentFactors.length > 0
    ? Math.max(...adjustmentFactors) / Math.min(...adjustmentFactors) - 1
    : Number.POSITIVE_INFINITY;
  const rangeIsComparable = reference.length >= 10 && factorSpread <= 0.01;
  const volumes = reference.map((bar) => bar.volume);

  return {
    sampleCount: reference.length,
    horizonSessions,
    volatilityPercent,
    recentHigh: rangeIsComparable ? Math.max(...reference.map((bar) => bar.high)) : null,
    recentLow: rangeIsComparable ? Math.min(...reference.map((bar) => bar.low)) : null,
    medianDailyVolume: volumes.length >= 10 ? median(volumes) : null,
    volumeSampleCount: volumes.length,
    source: reference.at(-1)?.source ?? null,
    priceBasis: adjustedCoverage ? "ADJUSTED_CLOSE" : "NONE",
  };
}
