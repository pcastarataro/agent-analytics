import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

import type { UsageEvent } from '@agent-analytics/event-schema';
import { usageEventSchema } from '@agent-analytics/event-schema';

import { usageEvents, definitions } from '../schema';
import {
  createDrizzleRepository,
  generateContentHash,
  type EventRepository,
} from '../repository';

const DATABASE_URL =
  process.env['DATABASE_URL'] ?? 'postgresql://postgres:postgres@localhost:5432/agent_analytics';

let client: ReturnType<typeof postgres>;
let db: ReturnType<typeof drizzle<Record<string, never>>>;
let repo: EventRepository;

beforeAll(async () => {
  client = postgres(DATABASE_URL);
  db = drizzle(client) as ReturnType<typeof drizzle<Record<string, never>>>;
  repo = createDrizzleRepository(db);

  await db.execute(sql`DROP TABLE IF EXISTS "usage_events"`);
  await db.execute(sql`CREATE TABLE "usage_events" (
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
    "event_type" text,
    "timestamp" timestamp with time zone,
    "status" text,
    "content_hash" text,
    "project_name" text GENERATED ALWAYS AS (coalesce(nullif("project"::jsonb->>'name', ''), 'unknown')) STORED,
    "project_branch" text GENERATED ALWAYS AS (coalesce(nullif("project"::jsonb->>'branch', ''), 'unknown')) STORED
  )`);
  await db.execute(sql`CREATE INDEX "idx_agent_name" ON "usage_events" ("agent_name")`);
  await db.execute(sql`CREATE INDEX "idx_session_id" ON "usage_events" ("session_id")`);
  await db.execute(sql`CREATE INDEX "idx_timestamp" ON "usage_events" ("timestamp")`);
  await db.execute(sql`CREATE INDEX "idx_status" ON "usage_events" ("status")`);
  await db.execute(sql`CREATE UNIQUE INDEX "idx_content_hash_unique" ON "usage_events" ("content_hash")`);
  await db.execute(sql`CREATE INDEX "idx_project_name" ON "usage_events" ("project_name")`);
  await db.execute(sql`CREATE INDEX "idx_project_branch" ON "usage_events" ("project_branch")`);
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
  describe('generateContentHash', () => {
    it('returns different hashes for events with identical payloads but different IDs', () => {
      const event1 = makeEvent({ id: 'id-1' });
      const event2 = makeEvent({ id: 'id-2' });

      const hash1 = generateContentHash(event1);
      const hash2 = generateContentHash(event2);

      expect(hash1).not.toBe(hash2);
    });

    it('returns same hash for identical events', () => {
      const event = makeEvent();
      const hash1 = generateContentHash(event);
      const hash2 = generateContentHash(event);
      expect(hash1).toBe(hash2);
    });
  });

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

    it('deduplicates events with same contentHash (same ID)', async () => {
      const event = makeEvent();
      await repo.insertBatch([event]);
      const count = await repo.insertBatch([event]);
      expect(count).toBe(1);

      const result = await db.select({ count: sql<number>`count(*)::int` }).from(usageEvents);
      expect(result[0]!.count).toBe(1);
    });

    it('deduplicates events with same contentHash across batches', async () => {
      const event1 = makeEvent({ id: '0192e000-1000-7000-8000-000000000001' });
      const event2 = makeEvent({ id: '0192e000-1000-7000-8000-000000000001' });

      await repo.insertBatch([event1]);
      await repo.insertBatch([event2]);

      const result = await db.select({ count: sql<number>`count(*)::int` }).from(usageEvents);
      expect(result[0]!.count).toBe(1);
    });

    it('allows events with different IDs (different contentHash)', async () => {
      const event1 = makeEvent({ id: '0192e000-1000-7000-8000-000000000001' });
      const event2 = makeEvent({ id: '0192e000-1000-7000-8000-000000000002' });

      await repo.insertBatch([event1]);
      await repo.insertBatch([event2]);

      const result = await db.select({ count: sql<number>`count(*)::int` }).from(usageEvents);
      expect(result[0]!.count).toBe(2);
    });

    it('allows events with different content (different contentHash)', async () => {
      const event1 = makeEvent({ id: '0192e000-1000-7000-8000-000000000001', result: { status: 'success' } });
      const event2 = makeEvent({ id: '0192e000-1000-7000-8000-000000000002', result: { status: 'error' } });

      await repo.insertBatch([event1]);
      await repo.insertBatch([event2]);

      const result = await db.select({ count: sql<number>`count(*)::int` }).from(usageEvents);
      expect(result[0]!.count).toBe(2);
    });
  });

  describe('findById', () => {
    it('returns null for non-existent ID', async () => {
      const result = await repo.findById('00000000-0000-0000-0000-000000000000');
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
          timestamp: new Date(Date.now() + i).toISOString(),
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
          timestamp: '2026-01-01T00:00:00.000Z',
        }),
        makeEvent({
          id: '0192e000-1000-7000-8000-000000000002',
          agent: { name: 'agent-a' } as UsageEvent['agent'],
          timestamp: '2026-01-01T00:00:01.000Z',
        }),
        makeEvent({
          id: '0192e000-1000-7000-8000-000000000003',
          agent: { name: 'agent-b' } as UsageEvent['agent'],
          timestamp: '2026-01-01T00:00:02.000Z',
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
        timestamp: '2026-01-15T10:30:00.000Z',
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
        timestamp: '2026-01-15T10:30:00.000Z',
      });

      await repo.insertBatch([minimal]);
      const retrieved = await repo.findById(minimal.id);

      expect(retrieved).not.toBeNull();

      const reparsed = usageEventSchema.parse(retrieved);
      expect(reparsed).toEqual(minimal);
    });
  });

  describe('getAgentStats', () => {
    it('groups by agent name and version with correct metrics', async () => {
      await repo.insertBatch([
        makeEvent({
          id: '0192e000-1000-7000-8000-000000000001',
          agent: { name: 'agent-a', version: '1.0.0' } as UsageEvent['agent'],
          metrics: { durationMs: 1000, cost: 0.1 },
          result: { status: 'success' },
        }),
        makeEvent({
          id: '0192e000-1000-7000-8000-000000000002',
          agent: { name: 'agent-a', version: '1.0.0' } as UsageEvent['agent'],
          metrics: { durationMs: 2000, cost: 0.2 },
          result: { status: 'error' },
        }),
        makeEvent({
          id: '0192e000-1000-7000-8000-000000000003',
          agent: { name: 'agent-a', version: '2.0.0' } as UsageEvent['agent'],
          metrics: { durationMs: 1500, cost: 0.15 },
          result: { status: 'success' },
        }),
        makeEvent({
          id: '0192e000-1000-7000-8000-000000000004',
          agent: { name: 'agent-b', version: '1.0.0' } as UsageEvent['agent'],
          metrics: { durationMs: 500, cost: 0.05 },
          result: { status: 'success' },
        }),
      ]);

      const stats = await repo.getAgentStats();

      expect(stats).toHaveLength(3);

      const agentAV1 = stats.find((s) => s.agentName === 'agent-a' && s.version === '1.0.0');
      expect(agentAV1).toBeDefined();
      expect(agentAV1!.executionCount).toBe(2);
      expect(agentAV1!.successRate).toBe(50);
      expect(agentAV1!.avgDurationMs).toBe(1500);
      expect(agentAV1!.totalCost).toBeCloseTo(0.3);

      const agentAV2 = stats.find((s) => s.agentName === 'agent-a' && s.version === '2.0.0');
      expect(agentAV2).toBeDefined();
      expect(agentAV2!.executionCount).toBe(1);
      expect(agentAV2!.successRate).toBe(100);

      const agentB = stats.find((s) => s.agentName === 'agent-b');
      expect(agentB).toBeDefined();
      expect(agentB!.executionCount).toBe(1);
    });

    it('filters by date range', async () => {
      await repo.insertBatch([
        makeEvent({
          id: '0192e000-1000-7000-8000-000000000001',
          agent: { name: 'agent-a' } as UsageEvent['agent'],
          timestamp: '2026-01-01T00:00:00.000Z',
        }),
        makeEvent({
          id: '0192e000-1000-7000-8000-000000000002',
          agent: { name: 'agent-a' } as UsageEvent['agent'],
          timestamp: '2026-06-01T00:00:00.000Z',
        }),
      ]);

      const stats = await repo.getAgentStats({
        from: new Date('2026-03-01T00:00:00Z'),
      });

      expect(stats).toHaveLength(1);
      expect(stats[0]!.executionCount).toBe(1);
    });

    it('returns empty array when no events', async () => {
      const stats = await repo.getAgentStats();
      expect(stats).toEqual([]);
    });
  });

  describe('getSkillStats', () => {
    it('groups by skill name and version with correct metrics', async () => {
      await repo.insertBatch([
        makeEvent({
          id: '0192e000-1000-7000-8000-000000000001',
          skill: { name: 'skill-a', version: '1.0.0' } as UsageEvent['skill'],
          metrics: { cost: 0.1 },
          result: { status: 'success' },
        }),
        makeEvent({
          id: '0192e000-1000-7000-8000-000000000002',
          skill: { name: 'skill-a', version: '1.0.0' } as UsageEvent['skill'],
          metrics: { cost: 0.2 },
          result: { status: 'success' },
        }),
        makeEvent({
          id: '0192e000-1000-7000-8000-000000000003',
          skill: { name: 'skill-b', version: '2.0.0' } as UsageEvent['skill'],
          metrics: { cost: 0.05 },
          result: { status: 'error' },
        }),
      ]);

      const stats = await repo.getSkillStats();

      expect(stats).toHaveLength(2);

      const skillA = stats.find((s) => s.skillName === 'skill-a');
      expect(skillA).toBeDefined();
      expect(skillA!.executionCount).toBe(2);
      expect(skillA!.successRate).toBe(100);
      expect(skillA!.totalCost).toBeCloseTo(0.3);

      const skillB = stats.find((s) => s.skillName === 'skill-b');
      expect(skillB).toBeDefined();
      expect(skillB!.executionCount).toBe(1);
      expect(skillB!.successRate).toBe(0);
    });

    it('returns empty array when no events', async () => {
      const stats = await repo.getSkillStats();
      expect(stats).toEqual([]);
    });
  });

  describe('getUserStats', () => {
    it('groups by userId with correct metrics', async () => {
      await repo.insertBatch([
        makeEvent({
          id: '0192e000-1000-7000-8000-000000000001',
          actor: { userId: 'user-1' },
          agent: { name: 'agent-a' } as UsageEvent['agent'],
          skill: { name: 'skill-a' } as UsageEvent['skill'],
          timestamp: '2026-01-01T00:00:00.000Z',
        }),
        makeEvent({
          id: '0192e000-1000-7000-8000-000000000002',
          actor: { userId: 'user-1' },
          agent: { name: 'agent-b' } as UsageEvent['agent'],
          skill: { name: 'skill-b' } as UsageEvent['skill'],
          timestamp: '2026-01-02T00:00:00.000Z',
        }),
        makeEvent({
          id: '0192e000-1000-7000-8000-000000000003',
          actor: { userId: 'user-2' },
          agent: { name: 'agent-a' } as UsageEvent['agent'],
          skill: { name: 'skill-a' } as UsageEvent['skill'],
          timestamp: '2026-01-03T00:00:00.000Z',
        }),
      ]);

      const stats = await repo.getUserStats();

      expect(stats).toHaveLength(2);

      const user1 = stats.find((s) => s.userId === 'user-1');
      expect(user1).toBeDefined();
      expect(user1!.eventCount).toBe(2);
      expect(user1!.distinctAgents).toBe(2);
      expect(user1!.distinctSkills).toBe(2);
      expect(user1!.firstSeenAt.getTime()).toBe(new Date('2026-01-01T00:00:00.000Z').getTime());
      expect(user1!.lastSeenAt.getTime()).toBe(new Date('2026-01-02T00:00:00.000Z').getTime());

      const user2 = stats.find((s) => s.userId === 'user-2');
      expect(user2).toBeDefined();
      expect(user2!.eventCount).toBe(1);
      expect(user2!.distinctAgents).toBe(1);
    });

    it('handles events with empty userId as "unknown"', async () => {
      await repo.insertBatch([
        makeEvent({
          id: '0192e000-1000-7000-8000-000000000001',
          actor: { userId: '' } as UsageEvent['actor'],
        }),
        makeEvent({
          id: '0192e000-1000-7000-8000-000000000002',
          actor: { userId: 'user-1' },
        }),
      ]);

      const stats = await repo.getUserStats();

      expect(stats).toHaveLength(2);

      const unknownUser = stats.find((s) => s.userId === 'unknown');
      expect(unknownUser).toBeDefined();
      expect(unknownUser!.eventCount).toBe(1);

      const knownUser = stats.find((s) => s.userId === 'user-1');
      expect(knownUser).toBeDefined();
      expect(knownUser!.eventCount).toBe(1);
    });

    it('returns empty array when no events', async () => {
      const stats = await repo.getUserStats();
      expect(stats).toEqual([]);
    });
  });

  describe('getAgentDetail - version breakdown', () => {
    it('returns correct distinctVersions and byVersion for multi-version events', async () => {
      await repo.insertBatch([
        makeEvent({
          id: '0192e000-1000-7000-8000-000000000001',
          agent: { name: 'alpha', version: '1.0.0' } as UsageEvent['agent'],
          metrics: { durationMs: 1000, cost: 0.1 },
          result: { status: 'success' },
        }),
        makeEvent({
          id: '0192e000-1000-7000-8000-000000000002',
          agent: { name: 'alpha', version: '1.0.0' } as UsageEvent['agent'],
          metrics: { durationMs: 1500, cost: 0.15 },
          result: { status: 'success' },
        }),
        makeEvent({
          id: '0192e000-1000-7000-8000-000000000003',
          agent: { name: 'alpha', version: '1.1.0' } as UsageEvent['agent'],
          metrics: { durationMs: 2000, cost: 0.2 },
          result: { status: 'error' },
        }),
      ]);

      const detail = await repo.getAgentDetail('alpha');

      expect(detail).not.toBeNull();
      expect(detail!.distinctVersions).toBe(2);
      expect(detail!.byVersion).toHaveLength(2);

      const v1 = detail!.byVersion.find((v) => v.version === '1.0.0');
      expect(v1).toBeDefined();
      expect(v1!.executionCount).toBe(2);
      expect(v1!.successRate).toBe(100);
      expect(v1!.totalCost).toBeCloseTo(0.25);

      const v2 = detail!.byVersion.find((v) => v.version === '1.1.0');
      expect(v2).toBeDefined();
      expect(v2!.executionCount).toBe(1);
      expect(v2!.successRate).toBe(0);
    });

    it('returns 404/throws for unknown agent', async () => {
      const detail = await repo.getAgentDetail('nonexistent');
      expect(detail).toBeNull();
    });

    it('returns single version when all events share version', async () => {
      await repo.insertBatch([
        makeEvent({
          id: '0192e000-1000-7000-8000-000000000001',
          agent: { name: 'beta', version: '1.0.0' } as UsageEvent['agent'],
        }),
        makeEvent({
          id: '0192e000-1000-7000-8000-000000000002',
          agent: { name: 'beta', version: '1.0.0' } as UsageEvent['agent'],
        }),
      ]);

      const detail = await repo.getAgentDetail('beta');

      expect(detail).not.toBeNull();
      expect(detail!.distinctVersions).toBe(1);
      expect(detail!.byVersion).toHaveLength(1);
      expect(detail!.byVersion[0]!.version).toBe('1.0.0');
    });
  });

  describe('getSkillDetail - version breakdown', () => {
    it('returns correct distinctVersions and byVersion for multi-version events', async () => {
      await repo.insertBatch([
        makeEvent({
          id: '0192e000-2000-7000-8000-000000000001',
          skill: { name: 'gamma', version: '2.0.0' } as UsageEvent['skill'],
          metrics: { durationMs: 800, cost: 0.08 },
          result: { status: 'success' },
        }),
        makeEvent({
          id: '0192e000-2000-7000-8000-000000000002',
          skill: { name: 'gamma', version: '2.0.0' } as UsageEvent['skill'],
          metrics: { durationMs: 900, cost: 0.09 },
          result: { status: 'success' },
        }),
        makeEvent({
          id: '0192e000-2000-7000-8000-000000000003',
          skill: { name: 'gamma', version: '2.1.0' } as UsageEvent['skill'],
          metrics: { durationMs: 700, cost: 0.07 },
          result: { status: 'error' },
        }),
      ]);

      const detail = await repo.getSkillDetail('gamma');

      expect(detail).not.toBeNull();
      expect(detail!.distinctVersions).toBe(2);
      expect(detail!.byVersion).toHaveLength(2);

      const v1 = detail!.byVersion.find((v) => v.version === '2.0.0');
      expect(v1).toBeDefined();
      expect(v1!.executionCount).toBe(2);
      expect(v1!.successRate).toBe(100);
      expect(v1!.totalCost).toBeCloseTo(0.17);

      const v2 = detail!.byVersion.find((v) => v.version === '2.1.0');
      expect(v2).toBeDefined();
      expect(v2!.executionCount).toBe(1);
      expect(v2!.successRate).toBe(0);
    });

    it('returns null for unknown skill', async () => {
      const detail = await repo.getSkillDetail('nonexistent');
      expect(detail).toBeNull();
    });

    it('returns single version when all events share version', async () => {
      await repo.insertBatch([
        makeEvent({
          id: '0192e000-2000-7000-8000-000000000004',
          skill: { name: 'delta', version: '3.0.0' } as UsageEvent['skill'],
        }),
        makeEvent({
          id: '0192e000-2000-7000-8000-000000000005',
          skill: { name: 'delta', version: '3.0.0' } as UsageEvent['skill'],
        }),
      ]);

      const detail = await repo.getSkillDetail('delta');

      expect(detail).not.toBeNull();
      expect(detail!.distinctVersions).toBe(1);
      expect(detail!.byVersion).toHaveLength(1);
      expect(detail!.byVersion[0]!.version).toBe('3.0.0');
    });
  });
});

describe('DefinitionRepository', () => {
  beforeAll(async () => {
    await db.execute(sql`DROP TABLE IF EXISTS "definitions"`);
    await db.execute(sql`CREATE TABLE "definitions" (
      "hash" text PRIMARY KEY NOT NULL,
      "content" text NOT NULL,
      "entity_type" text NOT NULL,
      "entity_name" text NOT NULL,
      "version" text,
      "created_at" timestamp with time zone DEFAULT now() NOT NULL,
      "updated_at" timestamp with time zone DEFAULT now() NOT NULL
    )`);
  });

  afterAll(async () => {
    await db.execute(sql`DROP TABLE IF EXISTS "definitions"`);
  });

  beforeEach(async () => {
    await db.delete(definitions);
  });

  describe('upsertDefinition', () => {
    it('sets version when provided', async () => {
      await repo.upsertDefinition('hash-1', 'content-1', 'agent', 'my-agent', '1.0.0');
      const def = await repo.getDefinitionByHash('hash-1');
      expect(def).not.toBeNull();
      expect(def!.version).toBe('1.0.0');
    });

    it('leaves version NULL when not provided', async () => {
      await repo.upsertDefinition('hash-2', 'content-2', 'skill', 'my-skill');
      const def = await repo.getDefinitionByHash('hash-2');
      expect(def).not.toBeNull();
      expect(def!.version).toBeNull();
    });

    it('updates version on conflict', async () => {
      await repo.upsertDefinition('hash-3', 'content-3', 'agent', 'my-agent', '1.0.0');
      await repo.upsertDefinition('hash-3', 'content-3-v2', 'agent', 'my-agent', '2.0.0');
      const def = await repo.getDefinitionByHash('hash-3');
      expect(def).not.toBeNull();
      expect(def!.version).toBe('2.0.0');
      expect(def!.content).toBe('content-3-v2');
    });
  });

  describe('getDefinitionByHash', () => {
    it('returns version field', async () => {
      await repo.upsertDefinition('hash-4', 'content-4', 'agent', 'my-agent', '3.0.0');
      const def = await repo.getDefinitionByHash('hash-4');
      expect(def).not.toBeNull();
      expect(def!.version).toBe('3.0.0');
      expect(def!.hash).toBe('hash-4');
      expect(def!.entityType).toBe('agent');
      expect(def!.entityName).toBe('my-agent');
    });

    it('returns null for non-existent hash', async () => {
      const def = await repo.getDefinitionByHash('nonexistent');
      expect(def).toBeNull();
    });
  });

  describe('getDefinitionsByEntity', () => {
    it('includes version in returned definitions', async () => {
      await repo.upsertDefinition('hash-5', 'content-5', 'agent', 'alpha', '1.0.0');
      await repo.upsertDefinition('hash-6', 'content-6', 'agent', 'alpha', '2.0.0');
      await repo.upsertDefinition('hash-7', 'content-7', 'agent', 'beta', null);

      const agentDefs = await repo.getDefinitionsByEntity('agent', 'alpha');
      expect(agentDefs).toHaveLength(2);
      expect(agentDefs.every((d) => d.entityName === 'alpha')).toBe(true);
      expect(agentDefs.some((d) => d.version === '1.0.0')).toBe(true);
      expect(agentDefs.some((d) => d.version === '2.0.0')).toBe(true);
    });
  });
});
