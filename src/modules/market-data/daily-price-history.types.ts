export type DailyBarAdjustment =
  | "RAW"
  | "RAW_WITH_ADJUSTED_CLOSE";

export type ProviderDailyPriceBar = {
  instrumentId: string;
  tradingDate: Date;
  open: string;
  high: string;
  low: string;
  close: string;
  adjustedClose: string | null;
  volume: bigint;
  adjustment: DailyBarAdjustment;
  source: string;
  providerTimestamp: Date;
  receivedAt: Date;
};

export type DailyHistoryInstrument = {
  id: string;
  symbol: string;
  exchange: string;
  timezone: string;
  providerIdentifier: string | null;
};
