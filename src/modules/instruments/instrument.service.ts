import type { SearchInstrumentsInput } from "./instrument.schemas";
import { instrumentRepository } from "./instrument.repository";
import { yahooInstrumentDiscoveryProvider } from "@/infrastructure/providers/yahoo-instrument-discovery-provider";
import {
  readDiscoveryCache,
  writeDiscoveryCache,
} from "@/infrastructure/cache/discovery-cache";

function calculateSearchPriority(
  query: string,
  instrument: {
    symbol: string;
    name: string;
  },
): number {
  const normalizedQuery = query.toLocaleLowerCase("en");
  const symbol =
    instrument.symbol.toLocaleLowerCase("en");
  const name =
    instrument.name.toLocaleLowerCase("en");

  if (symbol === normalizedQuery) {
    return 0;
  }

  if (symbol.startsWith(normalizedQuery)) {
    return 1;
  }

  if (name.startsWith(normalizedQuery)) {
    return 2;
  }

  return 3;
}

export const instrumentService = {
  async search(input: SearchInstrumentsInput) {
  const localInstruments =
    await instrumentRepository.search(
      input.query,
      input.limit,
    );

  const localResults = localInstruments.map(
    (instrument) => ({
      id: instrument.id,
      source: "CATALOG" as const,
      providerIdentifier: null,
      symbol: instrument.symbol,
      name: instrument.name,
      exchange: instrument.exchange,
      instrumentType:
        instrument.instrumentType,
      currency: instrument.currency,
      status: instrument.status,
    }),
  );

  let discoveredResults: Awaited<
    ReturnType<
      typeof yahooInstrumentDiscoveryProvider.search
    >
  > = [];

  let discoveryStatus:
    | "AVAILABLE"
    | "UNAVAILABLE"
    | "SKIPPED" = "SKIPPED";

  // Avoid an external request when PostgreSQL already supplied
  // enough results.
  if (localResults.length < input.limit) {
    const cachedDiscovery = await readDiscoveryCache(
      input.query,
      input.limit,
    );

    const discovery =
      cachedDiscovery ??
      (await yahooInstrumentDiscoveryProvider.searchWithStatus(
        input.query,
        input.limit,
      ));

    if (!cachedDiscovery) {
      await writeDiscoveryCache(
        input.query,
        input.limit,
        discovery,
      );
    }

    discoveredResults = discovery.instruments;
    discoveryStatus = discovery.status;
  }

  const localKeys = new Set(
    localResults.map(
      (instrument) =>
        `${instrument.exchange}:${instrument.symbol}:${instrument.instrumentType}`,
    ),
  );

  const uniqueDiscoveredResults =
    discoveredResults.filter(
      (instrument) =>
        !localKeys.has(
          `${instrument.exchange}:${instrument.symbol}:${instrument.instrumentType}`,
        ),
    );

  const instruments = [
    ...localResults,
    ...uniqueDiscoveredResults,
  ]
    .sort(
      (first, second) =>
        calculateSearchPriority(input.query, first) -
        calculateSearchPriority(input.query, second),
    )
    .slice(0, input.limit);

  return {
    instruments,
    discoveryStatus,
  };
},
};
