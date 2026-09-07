import { getMarketDataProvider } from "@/infrastructure/providers/get-market-data-provider";
import { instrumentRepository } from "@/modules/instruments/instrument.repository";
import type {
  MarketDataInstrument,
  ProviderQuote,
} from "./market-data.types";

import { quoteRepository } from "./quote.repository";


function hasValidPrice(price: string): boolean {
  const decimalPattern =
    /^(?:0|[1-9]\d*)(?:\.\d+)?$/;

  if (!decimalPattern.test(price)) {
    return false;
  }

  const representsZero =
    /^0+(?:\.0+)?$/.test(price);

  return !representsZero;
}

function hasValidTimestamp(timestamp: Date): boolean {
  return !Number.isNaN(timestamp.getTime());
}

function validateProviderQuotes(
  quotes: ProviderQuote[],
  requestedInstrumentIds: Set<string>,
) {
  const acceptedQuotes: ProviderQuote[] = [];
  const rejectedInstrumentIds: string[] = [];
  const seenInstrumentIds = new Set<string>();
  const rejectionReasons: Record<string, number> = {};

  for (const quote of quotes) {
    const wasRequested =
      requestedInstrumentIds.has(
        quote.instrumentId,
      );

    const isDuplicate =
      seenInstrumentIds.has(
        quote.instrumentId,
      );

    let rejectionReason: string | null = null;

    if (!wasRequested) rejectionReason = "UNREQUESTED_INSTRUMENT";
    else if (isDuplicate) rejectionReason = "DUPLICATE_INSTRUMENT";
    else if (!hasValidPrice(quote.price)) rejectionReason = "INVALID_PRICE";
    else if (!hasValidTimestamp(quote.providerTimestamp)) rejectionReason = "INVALID_PROVIDER_TIMESTAMP";
    else if (!hasValidTimestamp(quote.receivedAt)) rejectionReason = "INVALID_RECEIVED_TIMESTAMP";

    const isValid =
      wasRequested &&
      !isDuplicate &&
      hasValidPrice(quote.price) &&
      hasValidTimestamp(
        quote.providerTimestamp,
      ) &&
      hasValidTimestamp(quote.receivedAt);

    if (!isValid) {
      rejectedInstrumentIds.push(
        quote.instrumentId,
      );
      if (rejectionReason) {
        rejectionReasons[rejectionReason] =
          (rejectionReasons[rejectionReason] ?? 0) + 1;
      }

      continue;
    }

    seenInstrumentIds.add(
      quote.instrumentId,
    );

    acceptedQuotes.push(quote);
  }

  return {
    acceptedQuotes,
    rejectedInstrumentIds,
    seenInstrumentIds,
    rejectionReasons,
  };
}

export const marketDataService = {
  async refreshInstrumentQuote(
  instrument: MarketDataInstrument,
) {
  const provider = getMarketDataProvider();

  const quotes = await provider.getQuotes([
    instrument,
  ]);

  const requestedInstrumentIds = new Set([
    instrument.id,
  ]);

  const {
    acceptedQuotes,
    rejectedInstrumentIds,
    seenInstrumentIds,
  } = validateProviderQuotes(
    quotes,
    requestedInstrumentIds,
  );

  const missingInstrumentIds =
    seenInstrumentIds.has(instrument.id)
      ? []
      : [instrument.id];

  const storage =
    acceptedQuotes.length > 0
      ? await quoteRepository.storeQuotes(
          acceptedQuotes,
        )
      : {
          received: 0,
          historicalQuotesCreated: 0,
          latestQuotesUpdated: 0,
        };

  return {
    requested: 1,
    received: quotes.length,
    accepted: acceptedQuotes.length,
    rejected: rejectedInstrumentIds.length,
    missingInstrumentIds,
    rejectedInstrumentIds,
    storage,
  };
},

  async refreshWatchedQuotes(input: { runId?: string } = {}) {
    const startedAt = Date.now();
    const instruments =
      await instrumentRepository.findActivelyWatched();

    if (instruments.length === 0) {
      return {
        requested: 0,
        received: 0,
        accepted: 0,
        rejected: 0,
        missingInstrumentIds: [],
        rejectedInstrumentIds: [],
        rejectionReasons: {},
        runId: input.runId ?? null,
        providerDurationMs: 0,
        totalDurationMs: Date.now() - startedAt,
        storage: {
          received: 0,
          historicalQuotesCreated: 0,
          latestQuotesUpdated: 0,
        },
      };
    }

    const provider = getMarketDataProvider();

    const providerStartedAt = Date.now();
    const quotes =
      await provider.getQuotes(instruments);
    const providerDurationMs = Date.now() - providerStartedAt;

    const requestedInstrumentIds = new Set(
      instruments.map(
        (instrument) => instrument.id,
      ),
    );

    const {
      acceptedQuotes,
      rejectedInstrumentIds,
      seenInstrumentIds,
      rejectionReasons,
    } = validateProviderQuotes(
      quotes,
      requestedInstrumentIds,
    );

    const missingInstrumentIds = instruments
      .map((instrument) => instrument.id)
      .filter(
        (instrumentId) =>
          !seenInstrumentIds.has(instrumentId),
      );

    const storage =
      acceptedQuotes.length > 0
        ? await quoteRepository.storeQuotes(
            acceptedQuotes,
          )
        : {
            received: 0,
            historicalQuotesCreated: 0,
            latestQuotesUpdated: 0,
          };

    return {
      requested: instruments.length,
      received: quotes.length,
      accepted: acceptedQuotes.length,
      rejected: rejectedInstrumentIds.length,
      missingInstrumentIds,
      rejectedInstrumentIds,
      rejectionReasons,
      runId: input.runId ?? null,
      providerDurationMs,
      totalDurationMs: Date.now() - startedAt,
      storage,
    };
  },
};
