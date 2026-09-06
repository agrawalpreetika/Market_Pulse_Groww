-- CreateEnum
CREATE TYPE "SnapshotFreshness" AS ENUM ('FRESH', 'AGING', 'STALE', 'DELAYED', 'INDICATIVE', 'CONFLICTED', 'MARKET_CLOSED', 'UNKNOWN');

-- AlterTable
ALTER TABLE "review_snapshot_items" ADD COLUMN     "freshness_status" "SnapshotFreshness" NOT NULL DEFAULT 'UNKNOWN',
ADD COLUMN     "market_session" "MarketSession",
ADD COLUMN     "quote_age_seconds" INTEGER;
