CREATE TABLE "daily_history_sync_states" (
    "id" UUID NOT NULL,
    "instrument_id" UUID NOT NULL,
    "source" VARCHAR(50) NOT NULL,
    "checked_through_date" DATE,
    "last_attempt_at" TIMESTAMPTZ(6) NOT NULL,
    "last_succeeded_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "daily_history_sync_states_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "daily_history_sync_states_instrument_id_source_key"
ON "daily_history_sync_states"("instrument_id", "source");

CREATE INDEX "daily_history_sync_states_source_checked_through_date_idx"
ON "daily_history_sync_states"("source", "checked_through_date");

CREATE INDEX "daily_history_sync_states_last_attempt_at_idx"
ON "daily_history_sync_states"("last_attempt_at");

ALTER TABLE "daily_history_sync_states"
ADD CONSTRAINT "daily_history_sync_states_instrument_id_fkey"
FOREIGN KEY ("instrument_id") REFERENCES "instruments"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
