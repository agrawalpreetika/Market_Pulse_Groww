ALTER TABLE "review_snapshot_items"
ADD COLUMN "reference_sample_count" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "reference_volatility_percent" DECIMAL(10,4),
ADD COLUMN "reference_high" DECIMAL(18,6),
ADD COLUMN "reference_low" DECIMAL(18,6),
ADD COLUMN "reference_median_volume" BIGINT,
ADD COLUMN "reference_volume_sample_count" INTEGER NOT NULL DEFAULT 0;
