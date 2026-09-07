import type {
  DailyHistoryInstrument,
  ProviderDailyPriceBar,
} from "./daily-price-history.types";

export interface DailyPriceHistoryProvider {
  readonly source: string;

  getDailyBars(
    instruments: DailyHistoryInstrument[],
    now?: Date,
  ): Promise<ProviderDailyPriceBar[]>;
}
