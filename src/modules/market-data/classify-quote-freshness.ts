import type {
  MarketSession,
  QuoteQuality,
} from "./market-data.types";

export type QuoteFreshnessStatus =
  | "FRESH"
  | "AGING"
  | "STALE"
  | "DELAYED"
  | "INDICATIVE"
  | "CONFLICTED"
  | "MARKET_CLOSED";

export type QuoteFreshness = {
  status: QuoteFreshnessStatus;
  ageSeconds: number;
};

type ClassifyQuoteFreshnessInput = {
  providerTimestamp: Date;
  quality: QuoteQuality;
  session: MarketSession;
  now?: Date;
};

export function classifyQuoteFreshness({
  providerTimestamp,
  quality,
  session,
  now = new Date(),
}: ClassifyQuoteFreshnessInput): QuoteFreshness {
  const ageMilliseconds =
    now.getTime() - providerTimestamp.getTime();

  const ageSeconds = Math.max(
    0,
    Math.floor(ageMilliseconds / 1000),
  );

  if (quality === "CONFLICTED") {
    return {
      status: "CONFLICTED",
      ageSeconds,
    };
  }

  if (session === "CLOSED") {
  return {
    status: "MARKET_CLOSED",
    ageSeconds,
  };
}

  if (quality === "DELAYED") {
    return {
      status: "DELAYED",
      ageSeconds,
    };
  }

  if (quality === "INDICATIVE") {
    return {
      status: "INDICATIVE",
      ageSeconds,
    };
  }

  if (
    quality === "STALE" ||
    !Number.isFinite(
      providerTimestamp.getTime(),
    )
  ) {
    return {
      status: "STALE",
      ageSeconds,
    };
  }

  if (ageSeconds <= 60) {
    return {
      status: "FRESH",
      ageSeconds,
    };
  }

  if (ageSeconds <= 300) {
    return {
      status: "AGING",
      ageSeconds,
    };
  }

  return {
    status: "STALE",
    ageSeconds,
  };
}