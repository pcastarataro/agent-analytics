import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

import type { UsageEvent } from '@agent-analytics/event-schema';
import { usageEventSchema } from '@agent-analytics/event-schema';

import { usageEvents } from '../schema';
import { createDrizzleRepository, type EventRepository } from '../repository';

const DATABASE_URL =
  process.env['DATABASE_URL'] ?? 'postgresql://postgres:postgres@localhost:5432/agent_analytics';

let client: ReturnType<typeof postgres>;
let db: ReturnType<typeof drizzle<Record<string, never>>>;
let repo: EventRepository;

beforeAll(async () => {
  client = postgres(DATABASE_URL);
  db = drizzle(client) as ReturnType<typeof drizzle<Record<string, never>>>;
  repo = createDrizzleRepository(db);

  await db.execute(sql`CREATE TABLE IF NOT EXISTS "usage_events" (
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
  )`);
  await db.execute(
    sql`CREATE INDEX IF NOT EXISTS "idx_agent_name" ON "usage_events" ("agent_name")`,
  );
  await db.execute(
    sql`CREATE INDEX IF NOT EXISTS "idx_session_id" ON "usage_events" ("session_id")`,
  );
  await db.execute(sql`CREATE INDEX IF NOT EXISTS "idx_timestamp" ON "usage_events" ("timestamp")`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS "idx_status" ON "usage_events" ("status")`);
});

afterAll(async () => {
  await db.execute(sql`DROP TABLE IF EXISTS "usage_events"`);
  await client.end();
});

beforeEach(async () => {
  await db.delete(usageEvents);
});

function makeEvent(overrides: Partial<UsageEvent> = {}): UsageEvent {
  const base = usageEventSchema.parse({
    id: '0192e000-1000-7000-8000-000000000001',
    actor: { userId: 'user-1' },
    project: {},
    session: {},
    execution: { traceId: 'trace-1' },
    agent: { name: 'test-agent', version: '1.0.0', definitionHash: 'builtin:test-agent' },
    skill: { name: 'test-skill' },
    tool: {},
    model: { name: 'gpt-4' },
    metrics: { durationMs: 1000, inputTokens: 100, outputTokens: 50, cachedTokens: 10, cost: 0.05 },
    result: { status: 'success' },
  });

  return { ...base, ...overrides } as UsageEvent;
}

describe('EventRepository', () => {
  describe('insertBatch', () => {
    it('inserts a batch of events and returns count', async () => {
      const events = [makeEvent(), makeEvent({ id: '0192e000-1000-7000-8000-000000000002' })];
      const count = await repo.insertBatch(events);
      expect(count).toBe(2);
    });

    it('returns 0 for empty batch', async () => {
      const count = await repo.insertBatch([]);
      expect(count).toBe(0);
    });

    it('is idempotent for duplicate IDs', async () => {
      const event = makeEvent();
      await repo.insertBatch([event]);
      const count = await repo.insertBatch([event]);
      expect(count).toBe(1);

      const result = await db.select({ count: sql<number>`count(*)::int` }).from(usageEvents);
      expect(result[0]!.count).toBe(1);
    });
  });

  describe('findById', () => {
    it('returns null for non-existent ID', async () => {
      const result = await repo.findById('non-existent-id');
      expect(result).toBeNull();
    });

    it('returns the event by ID', async () => {
      const event = makeEvent();
      await repo.insertBatch([event]);
      const result = await repo.findById(event.id);
      expect(result).not.toBeNull();
      expect(result!.id).toBe(event.id);
    });
  });

  describe('findAll', () => {
    it('returns paginated results', async () => {
      const events = Array.from({ length: 15 }, (_, i) =>
        makeEvent({
          id: `0192e000-1000-7000-8000-${String(i).padStart(12, '0')}`,
        }),
      );
      await repo.insertBatch(events);

      const page1 = await repo.findAll({}, { limit: 10 });
      expect(page1.data).toHaveLength(10);
      expect(page1.nextCursor).not.toBeNull();

      const page2 = await repo.findAll({}, { limit: 10, cursor: page1.nextCursor! });
      expect(page2.data).toHaveLength(5);
      expect(page2.nextCursor).toBeNull();
    });

    it('filters by agentName', async () => {
      await repo.insertBatch([
        makeEvent({
          id: '0192e000-1000-7000-8000-000000000001',
          agent: { name: 'agent-a' } as UsageEvent['agent'],
        }),
        makeEvent({
          id: '0192e000-1000-7000-8000-000000000002',
          agent: { name: 'agent-b' } as UsageEvent['agent'],
        }),
      ]);

      const result = await repo.findAll({ agentName: 'agent-a' }, { limit: 10 });
      expect(result.data).toHaveLength(1);
      expect(result.data[0]!.agent.name).toBe('agent-a');
    });

    it('filters by status', async () => {
      await repo.insertBatch([
        makeEvent({ id: '0192e000-1000-7000-8000-000000000001', result: { status: 'success' } }),
        makeEvent({ id: '0192e000-1000-7000-8000-000000000002', result: { status: 'error' } }),
      ]);

      const result = await repo.findAll({ status: 'error' }, { limit: 10 });
      expect(result.data).toHaveLength(1);
      expect(result.data[0]!.result.status).toBe('error');
    });
  });

  describe('countByGroup', () => {
    it('counts by agentName', async () => {
      await repo.insertBatch([
        makeEvent({
          id: '0192e000-1000-7000-8000-000000000001',
          agent: { name: 'agent-a' } as UsageEvent['agent'],
        }),
        makeEvent({
          id: '0192e000-1000-7000-8000-000000000002',
          agent: { name: 'agent-a' } as UsageEvent['agent'],
        }),
        makeEvent({
          id: '0192e000-1000-7000-8000-000000000003',
          agent: { name: 'agent-b' } as UsageEvent['agent'],
        }),
      ]);

      const counts = await repo.countByGroup('agentName');
      expect(counts).toEqual({ 'agent-a': 2, 'agent-b': 1 });
    });

    it('throws for unsupported groupBy', async () => {
      await expect(
        (repo.countByGroup as (groupBy: string) => Promise<Record<string, number>>)('unsupported'),
      ).rejects.toThrow('Unsupported groupBy column');
    });
  });

  describe('Schema-to-Zod contract', () => {
    it('round-trips a maximal event through zod → insert → read → zod', async () => {
      const maximal: UsageEvent = usageEventSchema.parse({
        id: '0192e000-1000-7000-8000-000000000099',
        actor: { userId: 'user-99' },
        project: { name: 'test-project' },
        session: { mode: 'chat' },
        execution: { traceId: 'trace-99', parentId: 'parent-99' },
        agent: { name: 'agent-99', version: '2.0.0', definitionHash: 'abc123' },
        skill: { name: 'skill-99', version: '1.0.0', definitionHash: 'def456' },
        tool: { name: 'tool-99' },
        model: { name: 'claude-3' },
        metrics: {
          durationMs: 5000,
          inputTokens: 500,
          outputTokens: 200,
          cachedTokens: 50,
          cost: 0.15,
        },
        result: { status: 'success' },
      });

      await repo.insertBatch([maximal]);
      const retrieved = await repo.findById(maximal.id);

      expect(retrieved).not.toBeNull();

      const reparsed = usageEventSchema.parse(retrieved);
      expect(reparsed).toEqual(maximal);
    });

    it('round-trips a minimal event through zod → insert → read → zod', async () => {
      const minimal: UsageEvent = usageEventSchema.parse({
        id: '0192e000-1000-7000-8000-000000000088',
        actor: { userId: 'user-88' },
        project: {},
        session: {},
        execution: { traceId: 'trace-88' },
        agent: { name: 'minimal-agent' },
        skill: { name: 'minimal-skill' },
        tool: {},
        model: {},
        metrics: {},
        result: { status: 'error' },
      });

      await repo.insertBatch([minimal]);
      const retrieved = await repo.findById(minimal.id);

      expect(retrieved).not.toBeNull();

      const reparsed = usageEventSchema.parse(retrieved);
      expect(reparsed).toEqual(minimal);
    });
  });
});
