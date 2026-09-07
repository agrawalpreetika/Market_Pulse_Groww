CREATE TYPE "DailyBarAdjustment" AS ENUM ('RAW', 'RAW_WITH_ADJUSTED_CLOSE');

CREATE TABLE "daily_price_bars" (
    "id" UUID NOT NULL,
    "instrument_id" UUID NOT NULL,
    "trading_date" DATE NOT NULL,
    "open" DECIMAL(18,6) NOT NULL,
    "high" DECIMAL(18,6) NOT NULL,
    "low" DECIMAL(18,6) NOT NULL,
    "close" DECIMAL(18,6) NOT NULL,
    "adjusted_close" DECIMAL(18,6),
    "volume" BIGINT NOT NULL,
    "adjustment" "DailyBarAdjustment" NOT NULL,
    "source" VARCHAR(50) NOT NULL,
    "provider_timestamp" TIMESTAMPTZ(6) NOT NULL,
    "received_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "daily_price_bars_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "daily_price_bars_instrument_id_source_trading_date_key"
ON "daily_price_bars"("instrument_id", "source", "trading_date");
CREATE INDEX "daily_price_bars_instrument_id_trading_date_idx"
ON "daily_price_bars"("instrument_id", "trading_date" DESC);
CREATE INDEX "daily_price_bars_trading_date_idx"
ON "daily_price_bars"("trading_date");
ALTER TABLE "daily_price_bars"
ADD CONSTRAINT "daily_price_bars_instrument_id_fkey"
FOREIGN KEY ("instrument_id") REFERENCES "instruments"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
