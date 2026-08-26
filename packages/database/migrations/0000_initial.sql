-- Drizzle migration: 0000_initial

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
	"timestamp" timestamp with time zone,
	"status" text
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_agent_name" ON "usage_events" ("agent_name");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_session_id" ON "usage_events" ("session_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_timestamp" ON "usage_events" ("timestamp");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_status" ON "usage_events" ("status");
