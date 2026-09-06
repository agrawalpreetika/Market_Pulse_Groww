import { prisma } from "@/infrastructure/database/prisma";

import type { ProviderQuote } from "./market-data.types";

export const quoteRepository = {
  async storeQuotes(quotes: ProviderQuote[]) {
    return prisma.$transaction(async (transaction) => {
      let historicalQuotesCreated = 0;
      let latestQuotesUpdated = 0;

      for (const quote of quotes) {
        const historicalResult =
          await transaction.quote.createMany({
            data: [
              {
                instrumentId: quote.instrumentId,
                price: quote.price,
                previousClose: quote.previousClose,
                open: quote.open,
                high: quote.high,
                low: quote.low,
                volume: quote.volume,
                session: quote.session,
                quality: quote.quality,
                source: quote.source,
                providerTimestamp:
                  quote.providerTimestamp,
                receivedAt: quote.receivedAt,
              },
            ],
            skipDuplicates: true,
          });

        historicalQuotesCreated +=
          historicalResult.count;

        const currentLatest =
          await transaction.latestQuote.findUnique({
            where: {
              instrumentId: quote.instrumentId,
            },
          });

        const currentQuoteIsMock =
  currentLatest?.source.startsWith(
    "mock-",
  ) ?? false;

const incomingQuoteIsExternal =
  !quote.source.startsWith("mock-");

const incomingQuoteIsNewer =
  !currentLatest ||
  quote.providerTimestamp >
  currentLatest.providerTimestamp;

const isSameProviderObservation =
  currentLatest !== null &&
  currentLatest.source === quote.source &&
  currentLatest.providerTimestamp.getTime() ===
    quote.providerTimestamp.getTime();

const improvesSessionMetadata =
  isSameProviderObservation &&
  currentLatest.session === "UNKNOWN" &&
  quote.session !== "UNKNOWN";

const externalQuoteReplacesMock =
  currentQuoteIsMock &&
  incomingQuoteIsExternal;

const incomingQuoteShouldReplace =
  incomingQuoteIsNewer ||
  externalQuoteReplacesMock ||
  improvesSessionMetadata;

        if (!incomingQuoteShouldReplace) {
  continue;
}

        await transaction.latestQuote.upsert({
          where: {
            instrumentId: quote.instrumentId,
          },

          create: {
            instrumentId: quote.instrumentId,
            price: quote.price,
            previousClose: quote.previousClose,
            open: quote.open,
            high: quote.high,
            low: quote.low,
            volume: quote.volume,
            session: quote.session,
            quality: quote.quality,
            source: quote.source,
            providerTimestamp:
              quote.providerTimestamp,
            receivedAt: quote.receivedAt,
          },

          update: {
            price: quote.price,
            previousClose: quote.previousClose,
            open: quote.open,
            high: quote.high,
            low: quote.low,
            volume: quote.volume,
            session: quote.session,
            quality: quote.quality,
            source: quote.source,
            providerTimestamp:
              quote.providerTimestamp,
            receivedAt: quote.receivedAt,
          },
        });

        latestQuotesUpdated += 1;
      }

      return {
        received: quotes.length,
        historicalQuotesCreated,
        latestQuotesUpdated,
      };
    });
  },

  findLatestByInstrumentIds(
    instrumentIds: string[],
  ) {
    return prisma.latestQuote.findMany({
      where: {
        instrumentId: {
          in: instrumentIds,
        },
      },
    });
  },

  findHistory(
  instrumentId: string,
  from: Date,
  limit: number,
) {
  return prisma.quote.findMany({
    where: {
      instrumentId,
      providerTimestamp: {
        gte: from,
      },
    },

    orderBy: {
      providerTimestamp: "asc",
    },

    take: limit,

    select: {
      id: true,
      price: true,
      volume: true,
      session: true,
      quality: true,
      source: true,
      providerTimestamp: true,
    },
  });
},
};