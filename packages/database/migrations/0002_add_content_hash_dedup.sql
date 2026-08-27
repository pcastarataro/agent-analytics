-- Drizzle migration: 0002_add_content_hash_dedup

ALTER TABLE "usage_events" ADD COLUMN "content_hash" text;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "idx_content_hash_unique" ON "usage_events" ("content_hash");
