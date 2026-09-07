-- Freeze the watchlist item's threshold into each immutable review snapshot.
ALTER TABLE "review_snapshot_items"
ADD COLUMN "custom_threshold_percent" DECIMAL(8,4);
