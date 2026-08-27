import { jsonb, pgTable, index, text, timestamp, uuid } from 'drizzle-orm/pg-core';

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
    index('idx_content_hash').on(table.contentHash),
  ],
);

export type UsageEventRow = typeof usageEvents.$inferSelect;
export type UsageEventInsert = typeof usageEvents.$inferInsert;
