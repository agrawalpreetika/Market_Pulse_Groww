import { z } from "zod";

import type { MarketDataProvider } from "@/modules/market-data/market-data-provider";
import type {
  MarketDataInstrument,
  ProviderQuote,
} from "@/modules/market-data/market-data.types";

import { yahooHttpClient } from "./resilient-http-client";

const yahooChartSchema = z.object({
  chart: z.object({
    result: z
      .array(
        z.object({
          meta: z.object({
            regularMarketPrice: z.number().positive(),
            regularMarketTime: z
              .number()
              .int()
              .positive(),
            
            marketState: z.string().optional(),

            currentTradingPeriod: z
              .object({
                pre: z
                  .object({
                    start: z.number(),
                    end: z.number(),
                  })
                  .optional(),
                regular: z
                  .object({
                    start: z.number(),
                    end: z.number(),
                  })
                  .optional(),
                post: z
                  .object({
                    start: z.number(),
                    end: z.number(),
                  })
                  .optional(),
              })
              .optional(),

            previousClose: z
              .number()
              .positive()
              .nullable()
              .optional(),

            chartPreviousClose: z
              .number()
              .positive()
              .nullable()
              .optional(),

            regularMarketVolume: z
              .number()
              .nonnegative()
              .nullable()
              .optional(),

            regularMarketDayHigh: z
              .number()
              .positive()
              .nullable()
              .optional(),

            regularMarketDayLow: z
              .number()
              .positive()
              .nullable()
              .optional(),
          }),

          indicators: z
            .object({
              quote: z
                .array(
                  z.object({
                    open: z
                      .array(
                        z.number().nullable(),
                      )
                      .optional(),

                    high: z
                      .array(
                        z.number().nullable(),
                      )
                      .optional(),

                    low: z
                      .array(
                        z.number().nullable(),
                      )
                      .optional(),
                  }),
                )
                .optional(),
            })
            .optional(),
        }),
      )
      .nullable(),

    error: z.unknown().nullable(),
  }),
});

function yahooSymbol(
  instrument: MarketDataInstrument,
): string {
  if (instrument.exchange === "NSE") {
    return `${instrument.symbol}.NS`;
  }

  if (instrument.exchange === "BSE") {
    return `${instrument.symbol}.BO`;
  }

  throw new Error(
    `Yahoo provider does not support exchange ${instrument.exchange}`,
  );
}

function lastNumber(
  values:
    | Array<number | null>
    | undefined,
): number | null {
  if (!values) {
    return null;
  }

  for (
    let index = values.length - 1;
    index >= 0;
    index -= 1
  ) {
    const value = values[index];

    if (
      typeof value === "number" &&
      Number.isFinite(value)
    ) {
      return value;
    }
  }

  return null;
}

function decimalString(
  value: number | null | undefined,
): string | null {
  if (
    value === null ||
    value === undefined ||
    !Number.isFinite(value)
  ) {
    return null;
  }

  return value.toString();
}

type YahooTradingPeriod = {
  start: number;
  end: number;
};

function containsTimestamp(
  period: YahooTradingPeriod | undefined,
  timestamp: number,
): boolean {
  return Boolean(
    period &&
      timestamp >= period.start &&
      timestamp < period.end,
  );
}

function marketSessionFromYahooMetadata(input: {
  marketState?: string;
  currentTradingPeriod?: {
    pre?: YahooTradingPeriod;
    regular?: YahooTradingPeriod;
    post?: YahooTradingPeriod;
  };
}): ProviderQuote["session"] {
  switch (input.marketState?.toUpperCase()) {
    case "REGULAR":
      return "REGULAR";

    case "PRE":
    case "PREPRE":
      return "PRE_MARKET";

    case "POST":
    case "POSTPOST":
      return "AFTER_HOURS";

    case "CLOSED":
      return "CLOSED";
  }

  const nowSeconds = Math.floor(Date.now() / 1_000);
  const periods = input.currentTradingPeriod;

  if (containsTimestamp(periods?.regular, nowSeconds)) {
    return "REGULAR";
  }

  if (containsTimestamp(periods?.pre, nowSeconds)) {
    return "PRE_MARKET";
  }

  if (containsTimestamp(periods?.post, nowSeconds)) {
    return "AFTER_HOURS";
  }

  return "CLOSED";
}

async function fetchQuote(
  instrument: MarketDataInstrument,
): Promise<ProviderQuote | null> {
  let symbol: string;

  try {
    symbol = yahooSymbol(instrument);
  } catch (error: unknown) {
    console.warn(error);
    return null;
  }

  const url = new URL(
    `/v8/finance/chart/${encodeURIComponent(symbol)}`,
    "https://query1.finance.yahoo.com",
  );

  url.searchParams.set("interval", "1m");
  url.searchParams.set("range", "1d");

  let response: Response;

  try {
    response = await yahooHttpClient.fetch(url, {
      headers: {
        Accept: "application/json",
        "User-Agent":
          "Mozilla/5.0 MarketPulse/1.0",
      },
    });
  } catch (error: unknown) {
    console.warn(
      `Yahoo request failed for ${symbol}`,
      error,
    );

    return null;
  }

  if (!response.ok) {
    console.warn(
      `Yahoo returned HTTP ${response.status} for ${symbol}`,
    );

    return null;
  }

  let body: unknown;

  try {
    body = await response.json();
  } catch {
    console.warn(
      `Yahoo returned invalid JSON for ${symbol}`,
    );

    return null;
  }

  const parsed =
    yahooChartSchema.safeParse(body);

  if (!parsed.success) {
    console.warn(
      `Yahoo returned an invalid quote for ${symbol}`,
    );

    return null;
  }

  const result =
    parsed.data.chart.result?.[0];

  if (!result) {
    console.warn(
      `Yahoo returned no quote for ${symbol}`,
    );

    return null;
  }

  const meta = result.meta;
  const intraday =
    result.indicators?.quote?.[0];

  const previousClose =
    meta.previousClose ??
    meta.chartPreviousClose ??
    null;

  return {
    instrumentId: instrument.id,

    price: meta.regularMarketPrice.toString(),

    previousClose:
      decimalString(previousClose),

    open: decimalString(
      lastNumber(intraday?.open),
    ),

    high: decimalString(
      meta.regularMarketDayHigh ??
        lastNumber(intraday?.high),
    ),

    low: decimalString(
      meta.regularMarketDayLow ??
        lastNumber(intraday?.low),
    ),

    volume:
      meta.regularMarketVolume === null ||
      meta.regularMarketVolume === undefined
        ? null
        : BigInt(
            Math.trunc(
              meta.regularMarketVolume,
            ),
          ),

    session: marketSessionFromYahooMetadata({
      marketState: meta.marketState,
      currentTradingPeriod:
        meta.currentTradingPeriod,
    }),

    // Yahoo is not an exchange-licensed provider
    // for this application. Do not claim LIVE.
    quality: "DELAYED",

    source: "yahoo-finance-unofficial",

    providerTimestamp: new Date(
      meta.regularMarketTime * 1_000,
    ),

    receivedAt: new Date(),
  };
}

export class YahooMarketDataProvider
  implements MarketDataProvider
{
  async getQuotes(
    instruments: MarketDataInstrument[],
  ): Promise<ProviderQuote[]> {
    const quotes: ProviderQuote[] = [];

    // Start sequentially for predictable behaviour.
    // We will add bounded concurrency after verifying it.
    for (const instrument of instruments) {
      const quote = await fetchQuote(instrument);

      if (quote) {
        quotes.push(quote);
      }
    }

    return quotes;
  }
}
