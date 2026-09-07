import "dotenv/config";

import { prisma } from "../src/infrastructure/database/prisma";
import { disconnectRedis } from "../src/infrastructure/cache/redis";
import { runWithDistributedLease } from "../src/infrastructure/coordination/distributed-lease";
import { getIndianMarketState } from "../src/modules/market-data/indian-market-hours";
import { marketDataService } from "../src/modules/market-data/market-data.service";
import { createRunId, safeError, structuredLog } from "../src/shared/observability/structured-log";

const DEFAULT_INTERVAL_MS = 5 * 60 * 1_000;
const MINIMUM_INTERVAL_MS = 30 * 1_000;
const REFRESH_LEASE_TTL_MS = 4 * 60 * 1_000;

function getRefreshInterval(): number {
  const configured = Number(
    process.env.MARKET_REFRESH_INTERVAL_MS,
  );

  if (
    Number.isFinite(configured) &&
    configured >= MINIMUM_INTERVAL_MS
  ) {
    return configured;
  }

  return DEFAULT_INTERVAL_MS;
}

const refreshIntervalMs =
  getRefreshInterval();

let refreshInProgress = false;
let stopping = false;

async function runRefreshCycle() {
  if (refreshInProgress || stopping) {
    return;
  }

  const now = new Date();
  const runId = createRunId();
  const market = getIndianMarketState(now);

  if (!market.shouldRefresh) {
    structuredLog("info", "market-refresh-skipped", {
        runId,
        marketState: market.state,
        checkedAt: now.toISOString(),
      });

    return;
  }

  refreshInProgress = true;

  try {
    const leaseResult = await runWithDistributedLease({
      key: "market-pulse:v1:lease:market-refresh",
      ttlMs: REFRESH_LEASE_TTL_MS,
      task: () => marketDataService.refreshWatchedQuotes({ runId }),
    });

    if (leaseResult.outcome === "LOCKED") {
      structuredLog("info", "market-refresh-skipped", {
          runId,
          reason: "DISTRIBUTED_LEASE_HELD",
          checkedAt: new Date().toISOString(),
        });
      return;
    }

    const result = leaseResult.value;

    structuredLog("info", "market-refresh-completed", {
        coordination: leaseResult.outcome,
        completedAt: new Date().toISOString(),
        ...result,
      });
  } catch (error: unknown) {
    structuredLog("error", "market-refresh-failed", {
      runId,
      error: safeError(error),
    });
  } finally {
    refreshInProgress = false;
  }
}

async function shutdown(signal: string) {
  if (stopping) {
    return;
  }

  stopping = true;
  clearInterval(timer);

  console.log(
    JSON.stringify({
      event: "market-worker-stopping",
      signal,
    }),
  );

  while (refreshInProgress) {
    await new Promise((resolve) =>
      setTimeout(resolve, 100),
    );
  }

  await prisma.$disconnect();
  await disconnectRedis();
  process.exit(0);
}

console.log(
  JSON.stringify({
    event: "market-worker-started",
    provider:
      process.env.MARKET_DATA_PROVIDER ?? "mock",
    intervalMs: refreshIntervalMs,
    startedAt: new Date().toISOString(),
  }),
);

void runRefreshCycle();

const timer = setInterval(() => {
  void runRefreshCycle();
}, refreshIntervalMs);

process.once("SIGINT", () => {
  void shutdown("SIGINT");
});

process.once("SIGTERM", () => {
  void shutdown("SIGTERM");
});
