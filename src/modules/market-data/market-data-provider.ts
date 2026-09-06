import type {
  MarketDataInstrument,
  ProviderQuote,
} from "./market-data.types";

export interface MarketDataProvider {
  getQuotes(
    instruments: MarketDataInstrument[],
  ): Promise<ProviderQuote[]>;
}