import { z } from "zod";

import type { DailyPriceHistoryProvider } from "@/modules/market-data/daily-price-history-provider";
import type { DailyHistoryInstrument } from "@/modules/market-data/daily-price-history.types";
import { normalizeYahooDailyBars } from "@/modules/market-data/normalize-yahoo-daily-bars";

import { yahooHttpClient } from "./resilient-http-client";

const nullableNumbers = z.array(z.number().nullable()).optional();
const responseSchema = z.object({
  chart: z.object({
    result: z.array(z.object({
      timestamp: z.array(z.number().int().positive()).optional(),
      indicators: z.object({
        quote: z.array(z.object({
          open: nullableNumbers,
          high: nullableNumbers,
          low: nullableNumbers,
          close: nullableNumbers,
          volume: nullableNumbers,
        })).optional(),
        adjclose: z.array(z.object({
          adjclose: nullableNumbers,
        })).optional(),
      }),
    })).nullable(),
    error: z.unknown().nullable(),
  }),
});

export function yahooDailyHistorySymbol(
  instrument: DailyHistoryInstrument,
): string | null {
  const providerIdentifier = instrument.providerIdentifier?.trim();

  // Catalog rows may have been imported from another provider (for example
  // `INFY:NSE`). Reuse only identifiers that are actually in Yahoo format.
  if (providerIdentifier && /\.(?:NS|BO)$/i.test(providerIdentifier)) {
    return providerIdentifier;
  }
  if (instrument.exchange === "NSE") return `${instrument.symbol}.NS`;
  if (instrument.exchange === "BSE") return `${instrument.symbol}.BO`;
  return null;
}

export class YahooDailyPriceHistoryProvider
  implements DailyPriceHistoryProvider
{
  async getDailyBars(
    instruments: DailyHistoryInstrument[],
    now = new Date(),
  ) {
    const bars = [];

    for (const instrument of instruments) {
      const symbol = yahooDailyHistorySymbol(instrument);
      if (!symbol) continue;

      const url = new URL(
        `/v8/finance/chart/${encodeURIComponent(symbol)}`,
        "https://query1.finance.yahoo.com",
      );
      url.searchParams.set("interval", "1d");
      url.searchParams.set("range", "3mo");
      url.searchParams.set("events", "div,splits");

      try {
        const response = await yahooHttpClient.fetch(url, {
          headers: {
            Accept: "application/json",
            "User-Agent": "Mozilla/5.0 MarketPulse/1.0",
          },
        });
        if (!response.ok) {
          console.warn(`Yahoo daily history returned HTTP ${response.status} for ${symbol}`);
          continue;
        }

        const parsed = responseSchema.safeParse(await response.json());
        const result = parsed.success ? parsed.data.chart.result?.[0] : null;
        const quote = result?.indicators.quote?.[0];
        if (!result?.timestamp || !quote) {
          console.warn(`Yahoo returned invalid daily history for ${symbol}`);
          continue;
        }

        bars.push(...normalizeYahooDailyBars({
          instrumentId: instrument.id,
          timezone: instrument.timezone,
          now,
          receivedAt: new Date(),
          arrays: {
            timestamps: result.timestamp,
            open: quote.open,
            high: quote.high,
            low: quote.low,
            close: quote.close,
            volume: quote.volume,
            adjustedClose: result.indicators.adjclose?.[0]?.adjclose,
          },
        }));
      } catch (error: unknown) {
        console.warn(`Yahoo daily history request failed for ${symbol}`, error);
      }
    }

    return bars;
  }
}
