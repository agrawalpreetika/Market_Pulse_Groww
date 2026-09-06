export type MarketSession =
  | "PRE_MARKET"
  | "REGULAR"
  | "AFTER_HOURS"
  | "CLOSED"
  | "UNKNOWN";

export type QuoteQuality =
  | "LIVE"
  | "DELAYED"
  | "STALE"
  | "INDICATIVE"
  | "CONFLICTED";

export type MarketDataInstrument = {
  id: string;
  symbol: string;
  exchange: string;
  providerIdentifier: string | null;
};

export type ProviderQuote = {
  instrumentId: string;

  price: string;
  previousClose: string | null;
  open: string | null;
  high: string | null;
  low: string | null;
  volume: bigint | null;

  session: MarketSession;
  quality: QuoteQuality;
  source: string;

  providerTimestamp: Date;
  receivedAt: Date;
};