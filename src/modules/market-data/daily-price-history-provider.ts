import type {
  DailyHistoryInstrument,
  ProviderDailyPriceBar,
} from "./daily-price-history.types";

export interface DailyPriceHistoryProvider {
  getDailyBars(
    instruments: DailyHistoryInstrument[],
    now?: Date,
  ): Promise<ProviderDailyPriceBar[]>;
}
