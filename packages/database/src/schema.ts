import { jsonb, pgTable, index, uniqueIndex, text, timestamp, uuid } from 'drizzle-orm/pg-core';

export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull().unique(),
    passwordHash: text('password_hash').notNull(),
    apiKeyHash: text('api_key_hash'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index('idx_users_api_key_hash').on(table.apiKeyHash)],
);

export type UserRow = typeof users.$inferSelect;
export type UserInsert = typeof users.$inferInsert;

export const usageEvents = pgTable(
  'usage_events',
  {
    id: uuid('id').primaryKey(),
    actor: jsonb('actor'),
    project: jsonb('project'),
    session: jsonb('session'),
    execution: jsonb('execution'),
    agent: jsonb('agent'),
    skill: jsonb('skill'),
    tool: jsonb('tool'),
    model: jsonb('model'),
    metrics: jsonb('metrics'),
    result: jsonb('result'),
    agentName: text('agent_name'),
    sessionId: text('session_id'),
    eventType: text('event_type'),
    timestamp: timestamp('timestamp', { withTimezone: true }),
    status: text('status'),
    contentHash: text('content_hash'),
    projectName: text('project_name').generatedAlwaysAs(
      `coalesce(nullif("project"::jsonb->>'name', ''), 'unknown')`,
    ),
    projectBranch: text('project_branch').generatedAlwaysAs(
      `coalesce(nullif("project"::jsonb->>'branch', ''), 'unknown')`,
    ),
  },
  (table) => [
    index('idx_agent_name').on(table.agentName),
    index('idx_session_id').on(table.sessionId),
    index('idx_event_type').on(table.eventType),
    index('idx_timestamp').on(table.timestamp),
    index('idx_status').on(table.status),
    uniqueIndex('idx_content_hash_unique').on(table.contentHash),
    index('idx_project_name').on(table.projectName),
    index('idx_project_branch').on(table.projectBranch),
  ],
);

export const definitions = pgTable(
  'definitions',
  {
    hash: text('hash').primaryKey(),
    content: text('content').notNull(),
    entityType: text('entity_type').notNull(),
    entityName: text('entity_name').notNull(),
    version: text('version'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index('idx_definitions_entity_version').on(table.entityName, table.version)],
);

export type DefinitionRow = typeof definitions.$inferSelect;
export type DefinitionInsert = typeof definitions.$inferInsert;

export type UsageEventRow = typeof usageEvents.$inferSelect;
export type UsageEventInsert = typeof usageEvents.$inferInsert;
