import type { MarketDataProvider } from "@/modules/market-data/market-data-provider";

import { MockMarketDataProvider } from "./mock-market-data-provider";
import { TwelveDataMarketDataProvider } from "./twelve-data-market-data-provider";
import { YahooMarketDataProvider } from "./yahoo-market-data-provider";

let provider: MarketDataProvider | undefined;

export function getMarketDataProvider(): MarketDataProvider {
  if (provider) {
    return provider;
  }

  const providerName = (
    process.env.MARKET_DATA_PROVIDER ?? "mock"
  )
    .trim()
    .toLocaleLowerCase("en");

  switch (providerName) {
    case "mock":
      provider = new MockMarketDataProvider();
      return provider;
    
    case "twelve-data":
  provider =
    new TwelveDataMarketDataProvider();

  return provider;

    case "yahoo":
  provider = new YahooMarketDataProvider();
      return provider;
    
    default:
      throw new Error(
        `Unsupported market-data provider: ${providerName}`,
      );
  }
}