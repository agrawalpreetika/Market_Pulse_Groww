import { instrumentRepository } from "@/modules/instruments/instrument.repository";
import { AppError } from "@/shared/errors/app-error";

import { quoteRepository } from "./quote.repository";

type HistoryRange = "1D" | "1W" | "1M" | "3M";

const rangeMilliseconds: Record<
  HistoryRange,
  number
> = {
  "1D": 24 * 60 * 60 * 1000,
  "1W": 7 * 24 * 60 * 60 * 1000,
  "1M": 30 * 24 * 60 * 60 * 1000,
  "3M": 90 * 24 * 60 * 60 * 1000,
};

export const quoteHistoryService = {
  async getHistory(
    instrumentId: string,
    range: HistoryRange,
  ) {
    const instrument =
      await instrumentRepository.findById(
        instrumentId,
      );

    if (!instrument) {
      throw new AppError(
        "Instrument not found",
        "INSTRUMENT_NOT_FOUND",
        404,
      );
    }

    const now = new Date();

    const from = new Date(
      now.getTime() -
        rangeMilliseconds[range],
    );

    // A hard limit protects the API until proper
    // time-bucket downsampling is implemented.
    const maximumPoints = 500;

    const quotes =
      await quoteRepository.findHistory(
        instrumentId,
        from,
        maximumPoints,
      );

    return {
      instrument: {
        id: instrument.id,
        symbol: instrument.symbol,
        name: instrument.name,
        exchange: instrument.exchange,
        currency: instrument.currency,
      },

      range,
      from,
      to: now,

      points: quotes.map((quote) => ({
        id: quote.id,
        price: quote.price.toString(),
        volume:
          quote.volume?.toString() ?? null,
        session: quote.session,
        quality: quote.quality,
        source: quote.source,
        timestamp:
          quote.providerTimestamp,
      })),
    };
  },
};