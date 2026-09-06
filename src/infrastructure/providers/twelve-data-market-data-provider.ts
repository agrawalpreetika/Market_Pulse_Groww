import { z } from "zod";

import type { MarketDataProvider } from "@/modules/market-data/market-data-provider";
import type {
  MarketDataInstrument,
  ProviderQuote,
} from "@/modules/market-data/market-data.types";

const twelveDataQuoteSchema = z.object({
  symbol: z.string().min(1),
  exchange: z.string().optional(),
  close: z.string().min(1),
  previous_close: z.string().nullable().optional(),
  open: z.string().nullable().optional(),
  high: z.string().nullable().optional(),
  low: z.string().nullable().optional(),
  volume: z.string().nullable().optional(),
  timestamp: z.number().int().positive(),
  last_quote_at: z
  .number()
  .int()
  .positive()
  .optional(),
  is_market_open: z.boolean().optional(),
});

const twelveDataErrorSchema = z.object({
  status: z.literal("error"),
  message: z.string(),
});

type TwelveDataQuote = z.infer<
  typeof twelveDataQuoteSchema
>;

function optionalValue(
  value: string | null | undefined,
): string | null {
  return value ?? null;
}

function parseVolume(
  value: string | null | undefined,
): bigint | null {
  if (!value || !/^\d+$/.test(value)) {
    return null;
  }

  return BigInt(value);
}

function makeProviderQuote(
  instrument: MarketDataInstrument,
  quote: TwelveDataQuote,
  receivedAt: Date,
): ProviderQuote {
  const providerTimestamp = new Date(
  (quote.last_quote_at ?? quote.timestamp) *
    1_000,
);

  return {
    instrumentId: instrument.id,
    price: quote.close,
    previousClose: optionalValue(
      quote.previous_close,
    ),
    open: optionalValue(quote.open),
    high: optionalValue(quote.high),
    low: optionalValue(quote.low),
    volume: parseVolume(quote.volume),

    session:
      quote.is_market_open === true
        ? "REGULAR"
        : quote.is_market_open === false
          ? "CLOSED"
          : "UNKNOWN",

    // Use a conservative quality classification.
    // The trial does not guarantee that every NSE
    // response is exchange-real-time.
    quality: "DELAYED",
    source: "twelve-data",

    providerTimestamp,
    receivedAt,
  };
}

export class TwelveDataMarketDataProvider
  implements MarketDataProvider
{
  async getQuotes(
    instruments: MarketDataInstrument[],
  ): Promise<ProviderQuote[]> {
    const apiKey =
      process.env.TWELVE_DATA_API_KEY?.trim();

    if (!apiKey) {
      throw new Error(
        "TWELVE_DATA_API_KEY is not configured",
      );
    }

    const baseUrl =
      process.env.TWELVE_DATA_BASE_URL?.trim() ||
      "https://api.twelvedata.com";

    const usableInstruments = instruments.filter(
      (
        instrument,
      ): instrument is MarketDataInstrument & {
        providerIdentifier: string;
      } => Boolean(instrument.providerIdentifier),
    );

    if (usableInstruments.length === 0) {
      return [];
    }

    const quotes = await Promise.all(
      usableInstruments.map(async (instrument) => {
        const url = new URL("/quote", baseUrl);

        url.searchParams.set(
          "symbol",
          instrument.providerIdentifier,
        );

        url.searchParams.set("apikey", apiKey);

        const receivedAt = new Date();

        const response = await fetch(url, {
          headers: {
            Accept: "application/json",
          },
          signal: AbortSignal.timeout(8_000),
        });

        if (!response.ok) {
          throw new Error(
            `Twelve Data returned HTTP ${response.status}`,
          );
        }

        const body: unknown = await response.json();

        const providerError =
          twelveDataErrorSchema.safeParse(body);

        if (providerError.success) {
          console.warn(
            `Twelve Data rejected ${instrument.providerIdentifier}: ${providerError.data.message}`,
          );

          return null;
        }

        const parsed =
          twelveDataQuoteSchema.safeParse(body);

        if (!parsed.success) {
          console.warn(
            `Twelve Data returned an invalid quote for ${instrument.providerIdentifier}`,
          );

          return null;
        }

        return makeProviderQuote(
          instrument,
          parsed.data,
          receivedAt,
        );
      }),
    );

    return quotes.filter(
      (quote): quote is ProviderQuote =>
        quote !== null,
    );
  }
}