-- Drizzle migration: 0004_add_definition_version

ALTER TABLE "definitions" ADD COLUMN "version" text;

CREATE INDEX "idx_definitions_entity_version" ON "definitions" ("entity_name", "version");
