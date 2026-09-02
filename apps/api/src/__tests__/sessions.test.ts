import type {
  EventRepository,
  PaginatedResult,
  SessionSummary,
  SessionDetail,
} from '@agent-analytics/database';
import type { UsageEvent } from '@agent-analytics/event-schema';

import { createApp } from '../server';
import { loadConfig } from '../config';
import { createMockUserRepository } from './helpers';

function makeEvent(overrides: Partial<UsageEvent> = {}): UsageEvent {
  const base: UsageEvent = {
    id: '0192e000-1000-7000-8000-000000000001',
    actor: { userId: 'user-1' },
    project: {},
    session: {},
    execution: { traceId: 'trace-1' },
    agent: { name: 'test-agent' },
    skill: { name: 'test-skill' },
    tool: {},
    model: {},
    metrics: {},
    result: { status: 'success' },
  };
  return { ...base, ...overrides };
}

function makeSessionSummary(overrides: Partial<SessionSummary> = {}): SessionSummary {
  const base: SessionSummary = {
    sessionId: 'session-1',
    eventCount: 5,
    startedAt: new Date('2026-08-01T10:00:00Z'),
    lastEventAt: new Date('2026-08-01T10:05:00Z'),
    totalDurationMs: 1200,
    agentName: 'test-agent',
    eventTypes: ['session_created', 'user_message', 'assistant_message'],
  };
  return { ...base, ...overrides };
}

interface MockState {
  sessionSummaries: SessionSummary[];
  sessionEvents: Map<string, UsageEvent[]>;
}

function createMockRepository(state: MockState): EventRepository {
  return {
    insertBatch: jest.fn().mockResolvedValue(0),
    findById: jest.fn().mockResolvedValue(null),
    findAll: jest.fn().mockResolvedValue({ data: [], nextCursor: null }),
    countByGroup: jest.fn().mockResolvedValue({}),
    countByDate: jest.fn().mockResolvedValue({}),
    getMetricsAggregation: jest.fn().mockResolvedValue({
      usage: { totalEvents: 0, distinctSessions: 0, distinctExecutions: 0, agentInvocations: 0, skillInvocations: 0, toolCalls: 0 },
      performance: { totalDurationMs: 0, avgDurationMs: 0, totalInputTokens: 0, totalOutputTokens: 0, totalCachedTokens: 0, totalCost: 0, avgCost: 0 },
      quality: { successCount: 0, errorCount: 0, cancelledCount: 0, totalRetries: 0, successRate: 0, errorRate: 0 },
      evolution: { byAgentVersion: [], bySkillVersion: [] },
      byAgent: {},
      byStatus: {},
      byDate: {},
    }),
    getAgentStats: jest.fn().mockResolvedValue([]),
    getSkillStats: jest.fn().mockResolvedValue([]),
    getUserStats: jest.fn().mockResolvedValue([]),
    findSessionList: jest.fn().mockImplementation(
      async (
        pagination: { limit: number; cursor?: string },
        agentName?: string,
      ): Promise<PaginatedResult<SessionSummary>> => {
        let filtered = state.sessionSummaries;
        if (agentName !== undefined) {
          filtered = filtered.filter((s) => s.agentName === agentName);
        }
        const data = filtered.slice(0, pagination.limit);
        const hasMore = filtered.length > pagination.limit;
        return {
          data,
          nextCursor: hasMore && data.length > 0 ? 'next-cursor' : null,
        };
      },
    ),
    findSessionEvents: jest.fn().mockImplementation(
      async (sessionId: string): Promise<SessionDetail | null> => {
        const events = state.sessionEvents.get(sessionId);
        if (!events) return null;
        const summary = state.sessionSummaries.find((s) => s.sessionId === sessionId);
        if (!summary) return null;
        return { session: summary, events };
      },
    ),
    getAgentDetail: jest.fn().mockResolvedValue(null),
    getSkillDetail: jest.fn().mockResolvedValue(null),
    getUserDetail: jest.fn().mockResolvedValue(null),
    getDefinitionByHash: jest.fn().mockResolvedValue(null),
    upsertDefinition: jest.fn().mockResolvedValue(undefined),
    getDefinitionsByEntity: jest.fn().mockResolvedValue([]),
    getAllDefinitions: jest.fn().mockResolvedValue([]),
    getSkillVersions: jest.fn().mockResolvedValue([]),
    getUsedEntityNames: jest.fn().mockResolvedValue({ skills: [], agents: [] }),
    getProjectStats: jest.fn().mockResolvedValue([]),
    getProjectByName: jest.fn().mockResolvedValue(null),
    getBranchStats: jest.fn().mockResolvedValue([]),
    getBranchByName: jest.fn().mockResolvedValue(null),
    getCostOverTime: jest.fn().mockResolvedValue([]),
  };
}

describe('Session routes', () => {
  let app: ReturnType<typeof createApp>;
  let repo: EventRepository;
  let state: MockState;

  beforeEach(() => {
    state = { sessionSummaries: [], sessionEvents: new Map() };
    repo = createMockRepository(state);
    const config = loadConfig({
      port: 0,
      databaseUrl: 'postgresql://localhost:5432/test',
      corsOrigins: ['http://localhost:5173'],
    });
    app = createApp(config, repo, createMockUserRepository());
  });

  describe('GET /v1/sessions', () => {
    it('returns empty array when no sessions exist', async () => {
      const { default: request } = await import('supertest');
      const res = await request(app).get('/v1/sessions');

      expect(res.status).toBe(200);
      expect(res.body.data).toEqual([]);
      expect(res.body.nextCursor).toBeNull();
    });

    it('returns session list with aggregated data', async () => {
      const { default: request } = await import('supertest');

      state.sessionSummaries.push(
        makeSessionSummary({ sessionId: 'sess-1', eventCount: 10, agentName: 'agent-a' }),
        makeSessionSummary({ sessionId: 'sess-2', eventCount: 3, agentName: 'agent-b' }),
      );

      const res = await request(app).get('/v1/sessions');

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(2);
      expect(res.body.data[0].sessionId).toBe('sess-1');
      expect(res.body.data[0].eventCount).toBe(10);
      expect(res.body.data[0].agentName).toBe('agent-a');
      expect(res.body.data[1].sessionId).toBe('sess-2');
    });

    it('passes limit and cursor to repository', async () => {
      const { default: request } = await import('supertest');

      const res = await request(app).get('/v1/sessions?limit=5&cursor=some-cursor');

      expect(res.status).toBe(200);
      expect(repo.findSessionList).toHaveBeenCalledWith(
        { limit: 5, cursor: 'some-cursor' },
        undefined,
      );
    });

    it('clamps limit to max 100', async () => {
      const { default: request } = await import('supertest');

      const res = await request(app).get('/v1/sessions?limit=500');

      expect(res.status).toBe(200);
      expect(repo.findSessionList).toHaveBeenCalledWith(
        { limit: 100, cursor: undefined },
        undefined,
      );
    });

    it('clamps limit to min 1', async () => {
      const { default: request } = await import('supertest');

      const res = await request(app).get('/v1/sessions?limit=0');

      expect(res.status).toBe(200);
      expect(repo.findSessionList).toHaveBeenCalledWith(
        { limit: 1, cursor: undefined },
        undefined,
      );
    });

    it('passes agentName filter to repository', async () => {
      const { default: request } = await import('supertest');

      const res = await request(app).get('/v1/sessions?agentName=my-agent');

      expect(res.status).toBe(200);
      expect(repo.findSessionList).toHaveBeenCalledWith(
        expect.objectContaining({ limit: expect.any(Number) }),
        'my-agent',
      );
    });
  });

  describe('GET /v1/sessions/:traceId', () => {
    it('returns session detail with events ordered by time', async () => {
      const { default: request } = await import('supertest');

      const summary = makeSessionSummary({ sessionId: 'sess-abc' });
      const events = [
        makeEvent({
          id: '0192e000-1000-7000-8000-000000000001',
          execution: { traceId: 'sess-abc' },
          timestamp: '2026-08-01T10:00:00Z',
        }),
        makeEvent({
          id: '0192e000-1000-7000-8000-000000000002',
          execution: { traceId: 'sess-abc' },
          timestamp: '2026-08-01T10:01:00Z',
        }),
        makeEvent({
          id: '0192e000-1000-7000-8000-000000000003',
          execution: { traceId: 'sess-abc' },
          timestamp: '2026-08-01T10:02:00Z',
        }),
      ];
      state.sessionSummaries.push(summary);
      state.sessionEvents.set('sess-abc', events);

      const res = await request(app).get('/v1/sessions/sess-abc');

      expect(res.status).toBe(200);
      expect(res.body.data.session.sessionId).toBe('sess-abc');
      expect(res.body.data.session.eventCount).toBe(5); // from summary fixture
      expect(res.body.data.events).toHaveLength(3);
      // Events should be in order (mock returns them in insertion order)
      expect(res.body.data.events[0].id).toBe('0192e000-1000-7000-8000-000000000001');
      expect(res.body.data.events[2].id).toBe('0192e000-1000-7000-8000-000000000003');
    });

    it('returns 404 for invalid session ID', async () => {
      const { default: request } = await import('supertest');

      const res = await request(app).get('/v1/sessions/nonexistent');

      expect(res.status).toBe(404);
      expect(res.body.message).toBe('Session not found');
    });

    it('calls repository with the correct traceId', async () => {
      const { default: request } = await import('supertest');

      await request(app).get('/v1/sessions/my-session-123');

      expect(repo.findSessionEvents).toHaveBeenCalledWith('my-session-123');
    });
  });
});
