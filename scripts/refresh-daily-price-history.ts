import "dotenv/config";

import { prisma } from "@/infrastructure/database/prisma";
import { dailyPriceHistoryService } from "@/modules/market-data/daily-price-history.service";
import { createRunId, safeError, structuredLog } from "@/shared/observability/structured-log";

const runId = createRunId();

dailyPriceHistoryService.refreshWatchedHistory()
  .then((result) => {
    structuredLog("info", "daily-history-refresh-completed", { runId, ...result });
  })
  .catch((error: unknown) => {
    structuredLog("error", "daily-history-refresh-failed", {
      runId,
      error: safeError(error),
    });
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
