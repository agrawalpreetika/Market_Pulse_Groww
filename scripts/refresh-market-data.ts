import "dotenv/config";

import { prisma } from "@/infrastructure/database/prisma";
import { marketDataService } from "@/modules/market-data/market-data.service";

async function main() {
  const result =
    await marketDataService.refreshWatchedQuotes();

  console.log(
    JSON.stringify(result, null, 2),
  );
}

main()
  .catch((error: unknown) => {
    console.error(
      "Market-data refresh failed",
      error,
    );

    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });