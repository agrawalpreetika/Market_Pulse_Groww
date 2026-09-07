CREATE TYPE "ReferencePriceBasis" AS ENUM ('NONE', 'ADJUSTED_CLOSE');

ALTER TABLE "review_snapshot_items"
ADD COLUMN "reference_horizon_sessions" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "reference_source" VARCHAR(50),
ADD COLUMN "reference_price_basis" "ReferencePriceBasis" NOT NULL DEFAULT 'NONE';
