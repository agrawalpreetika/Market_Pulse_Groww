import { getDailyPriceHistoryProvider } from "@/infrastructure/providers/get-daily-price-history-provider";
import { instrumentRepository } from "@/modules/instruments/instrument.repository";

import { getLatestCompletedTradingDate } from "./completed-trading-date";
import { dailyPriceHistoryRepository } from "./daily-price-history.repository";

const DEFAULT_BATCH_SIZE = 20;
const DEFAULT_RETRY_INTERVAL_MS = 60 * 60 * 1_000;
const DEFAULT_RETENTION_DAYS = 730;

function boundedInteger(
  value: string | undefined,
  fallback: number,
  minimum: number,
  maximum: number,
) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= minimum && parsed <= maximum
    ? parsed
    : fallback;
}

function batches<T>(values: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    result.push(values.slice(index, index + size));
  }
  return result;
}

export const dailyPriceHistoryService = {
  async refreshWatchedHistory(
    now = new Date(),
    options: { force?: boolean } = {},
  ) {
    const instruments = await instrumentRepository.findActivelyWatched();
    const provider = getDailyPriceHistoryProvider();
    const targetDate = getLatestCompletedTradingDate(now);
    const states = await dailyPriceHistoryRepository.findSyncStates(
      instruments.map((instrument) => instrument.id),
      provider.source,
    );
    const stateByInstrumentId = new Map(
      states.map((state) => [state.instrumentId, state]),
    );
    const retryIntervalMs = boundedInteger(
      process.env.DAILY_HISTORY_RETRY_INTERVAL_MS,
      DEFAULT_RETRY_INTERVAL_MS,
      60_000,
      24 * 60 * 60 * 1_000,
    );
    const eligible = options.force
      ? instruments
      : instruments.filter((instrument) => {
          const state = stateByInstrumentId.get(instrument.id);
          if (!state) return true;

          const isBehind =
            !state.checkedThroughDate || state.checkedThroughDate < targetDate;
          const retryReady =
            now.getTime() - state.lastAttemptAt.getTime() >= retryIntervalMs;
          return isBehind && retryReady;
        });
    const eligibleInstrumentIds = new Set(
      eligible.map((instrument) => instrument.id),
    );
    const batchSize = boundedInteger(
      process.env.DAILY_HISTORY_BATCH_SIZE,
      DEFAULT_BATCH_SIZE,
      1,
      100,
    );
    const instrumentIdsWithBars = new Set<string>();
    let receivedBars = 0;
    let storedBars = 0;

    for (const batch of batches(eligible, batchSize)) {
      const attemptedAt = new Date();
      const bars = await provider.getDailyBars(batch, now);
      const successfulInstrumentIds = new Set(
        bars.map((bar) => bar.instrumentId),
      );
      const storage = await dailyPriceHistoryRepository.upsertCompletedBars(bars);

      receivedBars += bars.length;
      storedBars += storage.upserted;
      successfulInstrumentIds.forEach((id) => instrumentIdsWithBars.add(id));

      await dailyPriceHistoryRepository.recordSyncResults({
        instrumentIds: batch.map((instrument) => instrument.id),
        successfulInstrumentIds,
        source: provider.source,
        checkedThroughDate: targetDate,
        attemptedAt,
      });
    }

    let deletedExpiredBars = 0;
    if (eligible.length > 0) {
      const retentionDays = boundedInteger(
        process.env.DAILY_HISTORY_RETENTION_DAYS,
        DEFAULT_RETENTION_DAYS,
        180,
        3_650,
      );
      const cutoff = new Date(now);
      cutoff.setUTCDate(cutoff.getUTCDate() - retentionDays);
      const retention = await dailyPriceHistoryRepository.deleteOlderThan(cutoff);
      deletedExpiredBars = retention.count;
    }

    return {
      requestedInstruments: instruments.length,
      eligibleInstruments: eligible.length,
      instrumentsWithHistory: instrumentIdsWithBars.size,
      deferredInstrumentIds: instruments
        .filter((instrument) => !eligibleInstrumentIds.has(instrument.id))
        .map((instrument) => instrument.id),
      missingInstrumentIds: eligible
        .map((instrument) => instrument.id)
        .filter((id) => !instrumentIdsWithBars.has(id)),
      targetCompletedDate: targetDate.toISOString().slice(0, 10),
      receivedBars,
      storage: { received: receivedBars, upserted: storedBars },
      deletedExpiredBars,
    };
  },
};
