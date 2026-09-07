import { getDailyPriceHistoryProvider } from "@/infrastructure/providers/get-daily-price-history-provider";
import { instrumentRepository } from "@/modules/instruments/instrument.repository";

import { dailyPriceHistoryRepository } from "./daily-price-history.repository";

export const dailyPriceHistoryService = {
  async refreshWatchedHistory(now = new Date()) {
    const instruments = await instrumentRepository.findActivelyWatched();
    const provider = getDailyPriceHistoryProvider();
    const bars = await provider.getDailyBars(instruments, now);
    const instrumentIdsWithBars = new Set(bars.map((bar) => bar.instrumentId));
    const storage = await dailyPriceHistoryRepository.upsertCompletedBars(bars);

    return {
      requestedInstruments: instruments.length,
      instrumentsWithHistory: instrumentIdsWithBars.size,
      missingInstrumentIds: instruments
        .map((instrument) => instrument.id)
        .filter((id) => !instrumentIdsWithBars.has(id)),
      receivedBars: bars.length,
      storage,
    };
  },
};
