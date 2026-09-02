-- Drizzle migration: 0006_users

CREATE TABLE IF NOT EXISTS "users" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "name" text NOT NULL UNIQUE,
  "password_hash" text NOT NULL,
  "api_key_hash" text,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "idx_users_api_key_hash" ON "users" ("api_key_hash");

DELETE FROM "usage_events";

CREATE INDEX IF NOT EXISTS "idx_usage_events_user_id" ON "usage_events" USING btree ((actor::jsonb->>'userId'));
