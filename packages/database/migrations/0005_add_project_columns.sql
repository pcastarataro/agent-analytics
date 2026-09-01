-- Drizzle migration: 0005_add_project_columns

ALTER TABLE "usage_events" ADD COLUMN "project_name" text GENERATED ALWAYS AS (coalesce(nullif("project"::jsonb->>'name', ''), 'unknown')) STORED;
ALTER TABLE "usage_events" ADD COLUMN "project_branch" text GENERATED ALWAYS AS (coalesce(nullif("project"::jsonb->>'branch', ''), 'unknown')) STORED;

CREATE INDEX "idx_project_name" ON "usage_events" ("project_name");
CREATE INDEX "idx_project_branch" ON "usage_events" ("project_branch");
