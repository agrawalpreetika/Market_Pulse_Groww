-- CreateEnum
CREATE TYPE "MarketSession" AS ENUM ('PRE_MARKET', 'REGULAR', 'AFTER_HOURS', 'CLOSED', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "QuoteQuality" AS ENUM ('LIVE', 'DELAYED', 'STALE', 'INDICATIVE', 'CONFLICTED');

-- CreateTable
CREATE TABLE "quotes" (
    "id" UUID NOT NULL,
    "instrument_id" UUID NOT NULL,
    "price" DECIMAL(18,6) NOT NULL,
    "previous_close" DECIMAL(18,6),
    "open" DECIMAL(18,6),
    "high" DECIMAL(18,6),
    "low" DECIMAL(18,6),
    "volume" BIGINT,
    "session" "MarketSession" NOT NULL DEFAULT 'UNKNOWN',
    "quality" "QuoteQuality" NOT NULL,
    "source" VARCHAR(50) NOT NULL,
    "provider_timestamp" TIMESTAMPTZ(6) NOT NULL,
    "received_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "quotes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "latest_quotes" (
    "instrument_id" UUID NOT NULL,
    "price" DECIMAL(18,6) NOT NULL,
    "previous_close" DECIMAL(18,6),
    "open" DECIMAL(18,6),
    "high" DECIMAL(18,6),
    "low" DECIMAL(18,6),
    "volume" BIGINT,
    "session" "MarketSession" NOT NULL DEFAULT 'UNKNOWN',
    "quality" "QuoteQuality" NOT NULL,
    "source" VARCHAR(50) NOT NULL,
    "provider_timestamp" TIMESTAMPTZ(6) NOT NULL,
    "received_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "latest_quotes_pkey" PRIMARY KEY ("instrument_id")
);

-- CreateIndex
CREATE INDEX "quotes_instrument_id_provider_timestamp_idx" ON "quotes"("instrument_id", "provider_timestamp" DESC);

-- CreateIndex
CREATE INDEX "quotes_provider_timestamp_idx" ON "quotes"("provider_timestamp");

-- CreateIndex
CREATE UNIQUE INDEX "quotes_instrument_id_source_provider_timestamp_key" ON "quotes"("instrument_id", "source", "provider_timestamp");

-- CreateIndex
CREATE INDEX "latest_quotes_provider_timestamp_idx" ON "latest_quotes"("provider_timestamp");

-- AddForeignKey
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_instrument_id_fkey" FOREIGN KEY ("instrument_id") REFERENCES "instruments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "latest_quotes" ADD CONSTRAINT "latest_quotes_instrument_id_fkey" FOREIGN KEY ("instrument_id") REFERENCES "instruments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
