import { jsonb, pgTable, index, uniqueIndex, text, timestamp, uuid } from 'drizzle-orm/pg-core';

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
  },
  (table) => [
    index('idx_agent_name').on(table.agentName),
    index('idx_session_id').on(table.sessionId),
    index('idx_event_type').on(table.eventType),
    index('idx_timestamp').on(table.timestamp),
    index('idx_status').on(table.status),
    uniqueIndex('idx_content_hash_unique').on(table.contentHash),
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
