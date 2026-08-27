-- Drizzle migration: 0003_definitions

CREATE TABLE IF NOT EXISTS "definitions" (
	"hash" text PRIMARY KEY NOT NULL,
	"content" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
