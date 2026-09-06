-- CreateEnum
CREATE TYPE "ReviewStatus" AS ENUM ('OPEN', 'ACKNOWLEDGED', 'SUPERSEDED');

-- CreateTable
CREATE TABLE "watchlist_reviews" (
    "id" UUID NOT NULL,
    "watchlist_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "baseline_review_id" UUID,
    "snapshot_at" TIMESTAMPTZ(6) NOT NULL,
    "status" "ReviewStatus" NOT NULL DEFAULT 'OPEN',
    "version" INTEGER NOT NULL DEFAULT 1,
    "acknowledged_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "watchlist_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "review_snapshot_items" (
    "id" UUID NOT NULL,
    "review_id" UUID NOT NULL,
    "instrument_id" UUID NOT NULL,
    "price" DECIMAL(18,6),
    "previous_close" DECIMAL(18,6),
    "volume" BIGINT,
    "quote_quality" "QuoteQuality",
    "provider_timestamp" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "review_snapshot_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "watchlist_reviews_watchlist_id_status_idx" ON "watchlist_reviews"("watchlist_id", "status");

-- CreateIndex
CREATE INDEX "watchlist_reviews_user_id_idx" ON "watchlist_reviews"("user_id");

-- CreateIndex
CREATE INDEX "watchlist_reviews_baseline_review_id_idx" ON "watchlist_reviews"("baseline_review_id");

-- CreateIndex
CREATE INDEX "watchlist_reviews_snapshot_at_idx" ON "watchlist_reviews"("snapshot_at");

-- CreateIndex
CREATE INDEX "review_snapshot_items_instrument_id_idx" ON "review_snapshot_items"("instrument_id");

-- CreateIndex
CREATE UNIQUE INDEX "review_snapshot_items_review_id_instrument_id_key" ON "review_snapshot_items"("review_id", "instrument_id");

-- AddForeignKey
ALTER TABLE "watchlist_reviews" ADD CONSTRAINT "watchlist_reviews_watchlist_id_fkey" FOREIGN KEY ("watchlist_id") REFERENCES "watchlists"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "watchlist_reviews" ADD CONSTRAINT "watchlist_reviews_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "watchlist_reviews" ADD CONSTRAINT "watchlist_reviews_baseline_review_id_fkey" FOREIGN KEY ("baseline_review_id") REFERENCES "watchlist_reviews"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_snapshot_items" ADD CONSTRAINT "review_snapshot_items_review_id_fkey" FOREIGN KEY ("review_id") REFERENCES "watchlist_reviews"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_snapshot_items" ADD CONSTRAINT "review_snapshot_items_instrument_id_fkey" FOREIGN KEY ("instrument_id") REFERENCES "instruments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
