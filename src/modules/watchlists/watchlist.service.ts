
import { Prisma } from "@/generated/prisma/client";
import { AppError } from "@/shared/errors/app-error";
import { instrumentRepository } from "@/modules/instruments/instrument.repository";
import { calculatePriceChange } from "@/modules/market-data/calculate-price-change";
import { classifyQuoteFreshness } from "@/modules/market-data/classify-quote-freshness";
import { yahooInstrumentDiscoveryProvider } from "@/infrastructure/providers/yahoo-instrument-discovery-provider";
import { marketDataService } from "@/modules/market-data/market-data.service";

import type {
  AddWatchlistItemInput,
  CreateWatchlistInput,
  UpdateWatchlistInput,
} from "./watchlist.schemas";

import { watchlistRepository } from "./watchlist.repository";

function normalizeWatchlistName(name: string): string {
  return name.trim().toLocaleLowerCase("en");
}

export const watchlistService = {
  async listForUser(userId: string) {
    const watchlists =
      await watchlistRepository.findAllByUserId(userId);

    return watchlists.map((watchlist) => ({
      id: watchlist.id,
      name: watchlist.name,
      version: watchlist.version,
      itemCount: watchlist._count.items,
      createdAt: watchlist.createdAt,
      updatedAt: watchlist.updatedAt,
    }));
  },

  async createForUser(
    userId: string,
    input: CreateWatchlistInput,
  ) {
    const name = input.name.trim();
    const nameNormalized = normalizeWatchlistName(name);

    const existing =
      await watchlistRepository.findByNormalizedName(
        userId,
        nameNormalized,
      );

    if (existing) {
      throw new AppError(
        "A watchlist with this name already exists",
        "WATCHLIST_NAME_ALREADY_EXISTS",
        409,
      );
    }

    try {
      const watchlist = await watchlistRepository.create({
        userId,
        name,
        nameNormalized,
      });

      return {
        id: watchlist.id,
        name: watchlist.name,
        version: watchlist.version,
        itemCount: watchlist._count.items,
        createdAt: watchlist.createdAt,
        updatedAt: watchlist.updatedAt,
      };
    } catch (error: unknown) {
      if (
        error instanceof
          Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        throw new AppError(
          "A watchlist with this name already exists",
          "WATCHLIST_NAME_ALREADY_EXISTS",
          409,
        );
      }

      throw error;
    }
  },

  async getForUser(userId: string, watchlistId: string) {
  const watchlist =
    await watchlistRepository.findByIdForUser(
      watchlistId,
      userId,
    );

  if (!watchlist) {
    throw new AppError(
      "Watchlist not found",
      "WATCHLIST_NOT_FOUND",
      404,
    );
  }

  return {
    id: watchlist.id,
    name: watchlist.name,
    version: watchlist.version,
    createdAt: watchlist.createdAt,
    updatedAt: watchlist.updatedAt,

    items: watchlist.items.map((item) => ({
      id: item.id,
      addedAt: item.addedAt,
      displayOrder: item.displayOrder,
      userNote: item.userNote,
      customThreshold: item.customThreshold?.toString() ?? null,

      instrument: {
  id: item.instrument.id,
  symbol: item.instrument.symbol,
  name: item.instrument.name,
  exchange: item.instrument.exchange,
  instrumentType:
    item.instrument.instrumentType,
  currency: item.instrument.currency,
  status: item.instrument.status,

  latestQuote: item.instrument.latestQuote
    ? {
        price:
          item.instrument.latestQuote.price.toString(),

        previousClose:
          item.instrument.latestQuote.previousClose?.toString() ??
        null,
        
        change: calculatePriceChange(
  item.instrument.latestQuote.price.toString(),
  item.instrument.latestQuote.previousClose?.toString() ??
    null,
),

        open:
          item.instrument.latestQuote.open?.toString() ??
          null,

        high:
          item.instrument.latestQuote.high?.toString() ??
          null,

        low:
          item.instrument.latestQuote.low?.toString() ??
          null,

        volume:
          item.instrument.latestQuote.volume?.toString() ??
          null,

        session:
          item.instrument.latestQuote.session,

        quality:
        item.instrument.latestQuote.quality,
        
        freshness: classifyQuoteFreshness({
  providerTimestamp:
    item.instrument.latestQuote.providerTimestamp,

  quality:
    item.instrument.latestQuote.quality,

  session:
    item.instrument.latestQuote.session,
}),

        source:
          item.instrument.latestQuote.source,

        providerTimestamp:
          item.instrument.latestQuote.providerTimestamp,

        receivedAt:
          item.instrument.latestQuote.receivedAt,
      }
    : null,
},
    })),
  };
},

async updateForUser(
  userId: string,
  watchlistId: string,
  input: UpdateWatchlistInput,
) {
  await this.getForUser(
  userId,
  watchlistId,
);

  const name = input.name.trim();
  const nameNormalized =
    normalizeWatchlistName(name);

  const duplicate =
    await watchlistRepository.findByNormalizedName(
      userId,
      nameNormalized,
    );

  if (duplicate && duplicate.id !== watchlistId) {
    throw new AppError(
      "A watchlist with this name already exists",
      "WATCHLIST_NAME_ALREADY_EXISTS",
      409,
    );
  }

  const result =
    await watchlistRepository.updateWithVersion(
      watchlistId,
      userId,
      input.version,
      {
        name,
        nameNormalized,
      },
    );

  if (result.count === 0) {
    throw new AppError(
      "The watchlist was changed by another request. Reload and try again.",
      "WATCHLIST_VERSION_CONFLICT",
      409,
    );
  }

  return this.getForUser(userId, watchlistId);
},

async deleteForUser(
  userId: string,
  watchlistId: string,
) {
  const result =
    await watchlistRepository.deleteForUser(
      watchlistId,
      userId,
    );

  if (result.count === 0) {
    throw new AppError(
      "Watchlist not found",
      "WATCHLIST_NOT_FOUND",
      404,
    );
  }
  },

  async addItemForUser(
  userId: string,
  watchlistId: string,
  input: AddWatchlistItemInput,
) {
  await this.getForUser(userId, watchlistId);

    const isDiscoveredInstrument =
  !("instrumentId" in input);
let instrument;

if ("instrumentId" in input) {
  instrument =
    await instrumentRepository.findById(
      input.instrumentId,
    );

  if (!instrument) {
    throw new AppError(
      "Instrument not found",
      "INSTRUMENT_NOT_FOUND",
      404,
    );
  }
} else {
  const discoveredInstrument =
    await yahooInstrumentDiscoveryProvider
      .findByProviderIdentifier(
        input.providerIdentifier,
      );

  if (!discoveredInstrument) {
    throw new AppError(
      "The instrument could not be verified with Yahoo",
      "INSTRUMENT_VERIFICATION_FAILED",
      422,
    );
  }

  instrument =
    await instrumentRepository
      .upsertDiscoveredInstrument({
        symbol:
          discoveredInstrument.symbol,

        name:
          discoveredInstrument.name,

        exchange:
          discoveredInstrument.exchange,

        providerIdentifier:
          discoveredInstrument.providerIdentifier,
      });
}

  if (instrument.status !== "ACTIVE") {
    throw new AppError(
      "Only active instruments can be added to a watchlist",
      "INSTRUMENT_NOT_ACTIVE",
      409,
    );
  }

  const existingItem =
    await watchlistRepository.findItem(
      watchlistId,
      instrument.id,
    );

  if (existingItem) {
    throw new AppError(
      "This instrument is already in the watchlist",
      "WATCHLIST_ITEM_ALREADY_EXISTS",
      409,
    );
  }

  try {
    const item = await watchlistRepository.addItem({
      watchlistId,
      instrumentId: instrument.id,
      userNote: input.userNote,
      customThreshold: input.customThreshold,
    });

    if (isDiscoveredInstrument) {
  try {
    await marketDataService.refreshInstrumentQuote({
      id: instrument.id,
      symbol: instrument.symbol,
      exchange: instrument.exchange,
      providerIdentifier:
        instrument.providerIdentifier,
    });
  } catch (error: unknown) {
    // Instrument membership has already been saved.
    // A temporary provider failure must not undo it.
    console.warn(
      `Initial quote refresh failed for ${instrument.symbol}`,
      error,
    );
  }
}

    return {
      id: item.id,
      addedAt: item.addedAt,
      displayOrder: item.displayOrder,
      userNote: item.userNote,
      customThreshold:
        item.customThreshold?.toString() ?? null,

      instrument: {
        id: item.instrument.id,
        symbol: item.instrument.symbol,
        name: item.instrument.name,
        exchange: item.instrument.exchange,
        instrumentType:
          item.instrument.instrumentType,
        currency: item.instrument.currency,
        status: item.instrument.status,
      },
    };
  } catch (error: unknown) {
    if (
      error instanceof
        Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw new AppError(
        "This instrument is already in the watchlist",
        "WATCHLIST_ITEM_ALREADY_EXISTS",
        409,
      );
    }

    throw error;
  }
},

async removeItemForUser(
  userId: string,
  watchlistId: string,
  instrumentId: string,
) {
  await this.getForUser(userId, watchlistId);

  const result =
    await watchlistRepository.removeItem(
      watchlistId,
      instrumentId,
    );

  if (result.count === 0) {
    throw new AppError(
      "The instrument is not in this watchlist",
      "WATCHLIST_ITEM_NOT_FOUND",
      404,
    );
  }
},
};