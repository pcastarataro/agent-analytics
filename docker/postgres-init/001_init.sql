-- Initial schema for agent-analytics
-- Runs automatically via docker-entrypoint-initdb.d on fresh volumes

CREATE TABLE IF NOT EXISTS "usage_events" (
	"id" uuid PRIMARY KEY NOT NULL,
	"actor" jsonb,
	"project" jsonb,
	"session" jsonb,
	"execution" jsonb,
	"agent" jsonb,
	"skill" jsonb,
	"tool" jsonb,
	"model" jsonb,
	"metrics" jsonb,
	"result" jsonb,
	"agent_name" text,
	"session_id" text,
	"event_type" text,
	"timestamp" timestamp with time zone,
	"status" text
);

CREATE INDEX IF NOT EXISTS "idx_agent_name" ON "usage_events" ("agent_name");
CREATE INDEX IF NOT EXISTS "idx_session_id" ON "usage_events" ("session_id");
CREATE INDEX IF NOT EXISTS "idx_event_type" ON "usage_events" ("event_type");
CREATE INDEX IF NOT EXISTS "idx_timestamp" ON "usage_events" ("timestamp");
CREATE INDEX IF NOT EXISTS "idx_status" ON "usage_events" ("status");
CREATE INDEX IF NOT EXISTS "idx_session_id_timestamp" ON "usage_events" ("session_id", "timestamp");
