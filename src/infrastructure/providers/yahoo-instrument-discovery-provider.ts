import { z } from "zod";

import { yahooHttpClient } from "./resilient-http-client";

const yahooSearchResponseSchema = z.object({
  quotes: z
    .array(
      z.object({
        symbol: z.string(),
        shortname: z.string().optional(),
        longname: z.string().optional(),
        quoteType: z.string().optional(),
        exchange: z.string().optional(),
      }),
    ),
});

export type DiscoveredInstrument = {
  source: "YAHOO";
  providerIdentifier: string;
  symbol: string;
  name: string;
  exchange: "NSE" | "BSE";
  instrumentType: "EQUITY";
  currency: "INR";
  status: "ACTIVE";
};

export type InstrumentDiscoveryStatus =
  | "AVAILABLE"
  | "UNAVAILABLE";

export type InstrumentDiscoveryResult = {
  instruments: DiscoveredInstrument[];
  status: InstrumentDiscoveryStatus;
};

function normalizeYahooInstrument(
  quote: z.infer<
    typeof yahooSearchResponseSchema
  >["quotes"][number],
): DiscoveredInstrument | null {
  const providerIdentifier =
    quote.symbol.trim().toUpperCase();

  let exchange: "NSE" | "BSE";
  let symbol: string;

  if (providerIdentifier.endsWith(".NS")) {
    exchange = "NSE";
    symbol = providerIdentifier.slice(0, -3);
  } else if (providerIdentifier.endsWith(".BO")) {
    exchange = "BSE";
    symbol = providerIdentifier.slice(0, -3);
  } else {
    return null;
  }

  // Keep the MVP limited to ordinary equity instruments.
  if (
    quote.quoteType &&
    quote.quoteType.toUpperCase() !== "EQUITY"
  ) {
    return null;
  }

  if (!symbol) {
    return null;
  }

  return {
    source: "YAHOO",
    providerIdentifier,
    symbol,
    name:
      quote.longname?.trim() ||
      quote.shortname?.trim() ||
      symbol,
    exchange,
    instrumentType: "EQUITY",
    currency: "INR",
    status: "ACTIVE",
  };
}

async function searchYahooInstruments(
    query: string,
    limit: number,
  ): Promise<InstrumentDiscoveryResult> {
    const url = new URL(
      "/v1/finance/search",
      "https://query1.finance.yahoo.com",
    );

    url.searchParams.set("q", query.trim());
    url.searchParams.set(
      "quotesCount",
      String(Math.min(limit * 3, 30)),
    );
    url.searchParams.set("newsCount", "0");
    url.searchParams.set("listsCount", "0");
    url.searchParams.set("enableFuzzyQuery", "false");

    let response: Response;

    try {
      response = await yahooHttpClient.fetch(url, {
        headers: {
          Accept: "application/json",
          "User-Agent": "Mozilla/5.0 MarketPulse/1.0",
        },
        cache: "no-store",
      });
    } catch (error: unknown) {
      console.warn(
        "Yahoo instrument discovery request failed",
        error,
      );

      // Local PostgreSQL search can still work.
      return {
        instruments: [],
        status: "UNAVAILABLE",
      };
    }

    if (!response.ok) {
      console.warn(
        `Yahoo instrument discovery returned HTTP ${response.status}`,
      );

      return {
        instruments: [],
        status: "UNAVAILABLE",
      };
    }

    let body: unknown;

    try {
      body = await response.json();
    } catch {
      console.warn(
        "Yahoo instrument discovery returned invalid JSON",
      );

      return {
        instruments: [],
        status: "UNAVAILABLE",
      };
    }

    const parsed =
      yahooSearchResponseSchema.safeParse(body);

    if (!parsed.success) {
      console.warn(
        "Yahoo instrument discovery response was invalid",
      );

      return {
        instruments: [],
        status: "UNAVAILABLE",
      };
    }

    const uniqueResults = new Map<
      string,
      DiscoveredInstrument
    >();

    for (const quote of parsed.data.quotes) {
      const instrument =
        normalizeYahooInstrument(quote);

      if (!instrument) {
        continue;
      }

      if (
        !uniqueResults.has(
          instrument.providerIdentifier,
        )
      ) {
        uniqueResults.set(
          instrument.providerIdentifier,
          instrument,
        );
      }

      if (uniqueResults.size >= limit) {
        break;
      }
    }

    return {
      instruments: [...uniqueResults.values()],
      status: "AVAILABLE",
    };
}
  
  function isSupportedProviderIdentifier(
  value: string,
): boolean {
  return /^[A-Z0-9&._-]+\.(NS|BO)$/.test(value);
}

export const yahooInstrumentDiscoveryProvider = {
  searchWithStatus: searchYahooInstruments,

  async search(
    query: string,
    limit: number,
  ): Promise<DiscoveredInstrument[]> {
    const result = await searchYahooInstruments(
      query,
      limit,
    );

    return result.instruments;
  },

  async findByProviderIdentifier(
    providerIdentifier: string,
  ): Promise<DiscoveredInstrument | null> {
    const normalizedIdentifier =
      providerIdentifier.trim().toUpperCase();

    if (
      !isSupportedProviderIdentifier(
        normalizedIdentifier,
      )
    ) {
      return null;
    }

    const result = await searchYahooInstruments(
      normalizedIdentifier,
      10,
    );

    return (
      result.instruments.find(
        (instrument) =>
          instrument.providerIdentifier ===
          normalizedIdentifier,
      ) ?? null
    );
  },
};
