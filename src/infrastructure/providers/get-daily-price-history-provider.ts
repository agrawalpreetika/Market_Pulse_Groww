import type { DailyPriceHistoryProvider } from "@/modules/market-data/daily-price-history-provider";

import { YahooDailyPriceHistoryProvider } from "./yahoo-daily-price-history-provider";

let provider: DailyPriceHistoryProvider | undefined;

export function getDailyPriceHistoryProvider(): DailyPriceHistoryProvider {
  if (provider) return provider;

  const name = (process.env.DAILY_HISTORY_PROVIDER ?? "yahoo")
    .trim()
    .toLocaleLowerCase("en");

  if (name !== "yahoo") {
    throw new Error(`Unsupported daily-history provider: ${name}`);
  }

  provider = new YahooDailyPriceHistoryProvider();
  return provider;
}
