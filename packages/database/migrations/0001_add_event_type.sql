-- Drizzle migration: 0001_add_event_type

ALTER TABLE "usage_events" ADD COLUMN "event_type" text;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_event_type" ON "usage_events" ("event_type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_session_id_timestamp" ON "usage_events" ("session_id", "timestamp");
