type HistoricalObservation = {
  price: number;
  high: number | null;
  low: number | null;
  volume: bigint | null;
  source: string;
  providerTimestamp: Date;
};

export type FrozenReferenceContext = {
  sampleCount: number;
  volatilityPercent: number | null;
  recentHigh: number | null;
  recentLow: number | null;
  medianDailyVolume: bigint | null;
  volumeSampleCount: number;
};

function sourceFamily(source: string): string {
  return source.startsWith("mock-") ? "mock" : source;
}

function marketDate(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const value = Object.fromEntries(
    parts.map((part) => [part.type, part.value]),
  );
  return `${value.year}-${value.month}-${value.day}`;
}

function median(values: bigint[]): bigint | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) =>
    a < b ? -1 : a > b ? 1 : 0,
  );
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / BigInt(2);
}

export function buildReferenceContext(input: {
  observations: HistoricalObservation[];
  currentSource: string | null;
  currentTimestamp: Date | null;
  maximumTradingDays?: number;
}): FrozenReferenceContext {
  const empty: FrozenReferenceContext = {
    sampleCount: 0,
    volatilityPercent: null,
    recentHigh: null,
    recentLow: null,
    medianDailyVolume: null,
    volumeSampleCount: 0,
  };

  if (!input.currentSource || !input.currentTimestamp) return empty;

  const currentDate = marketDate(input.currentTimestamp);
  const family = sourceFamily(input.currentSource);
  const latestByDay = new Map<string, HistoricalObservation>();

  for (const observation of input.observations) {
    if (
      sourceFamily(observation.source) !== family ||
      !Number.isFinite(observation.price) ||
      observation.price <= 0
    ) continue;

    const date = marketDate(observation.providerTimestamp);
    if (date >= currentDate) continue;

    const existing = latestByDay.get(date);
    if (!existing || existing.providerTimestamp < observation.providerTimestamp) {
      latestByDay.set(date, observation);
    }
  }

  const days = [...latestByDay.values()]
    .sort((a, b) => a.providerTimestamp.getTime() - b.providerTimestamp.getTime())
    .slice(-(input.maximumTradingDays ?? 30));

  if (days.length === 0) return empty;

  const returns: number[] = [];
  for (let index = 1; index < days.length; index += 1) {
    const value = ((days[index].price - days[index - 1].price) / days[index - 1].price) * 100;
    if (Number.isFinite(value)) returns.push(value);
  }

  let volatilityPercent: number | null = null;
  if (returns.length >= 10) {
    const mean = returns.reduce((sum, value) => sum + value, 0) / returns.length;
    const variance = returns.reduce(
      (sum, value) => sum + (value - mean) ** 2,
      0,
    ) / (returns.length - 1);
    volatilityPercent = Number(Math.sqrt(variance).toFixed(4));
  }

  const highs = days.map((day) => day.high ?? day.price).filter(Number.isFinite);
  const lows = days.map((day) => day.low ?? day.price).filter(Number.isFinite);
  const volumes = days
    .map((day) => day.volume)
    .filter((value): value is bigint => value !== null && value >= 0);

  return {
    sampleCount: days.length,
    volatilityPercent,
    recentHigh: highs.length >= 10 ? Math.max(...highs) : null,
    recentLow: lows.length >= 10 ? Math.min(...lows) : null,
    medianDailyVolume: volumes.length >= 10 ? median(volumes) : null,
    volumeSampleCount: volumes.length,
  };
}
