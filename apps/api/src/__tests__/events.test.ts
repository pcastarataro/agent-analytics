import type { EventRepository, PaginatedResult, EventFilters, Pagination } from '@agent-analytics/database';
import type { UsageEvent } from '@agent-analytics/event-schema';

import { createApp } from '../server';
import { loadConfig } from '../config';

function createMockRepository(): EventRepository {
  const events: UsageEvent[] = [];
  return {
    insertBatch: jest.fn().mockImplementation(async (newEvents: UsageEvent[]) => {
      events.push(...newEvents);
      return newEvents.length;
    }),
    findById: jest.fn().mockImplementation(async (id: string) => {
      return events.find((e) => e.id === id) ?? null;
    }),
    findAll: jest.fn().mockImplementation(async (_filters: EventFilters, pagination: Pagination) => {
      const limit = pagination.limit;
      const data = events.slice(0, limit);
      const nextCursor = data.length === limit ? data[data.length - 1]?.id ?? null : null;
      return { data, nextCursor } satisfies PaginatedResult<UsageEvent>;
    }),
    countByGroup: jest.fn().mockResolvedValue({}),
  };
}

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

describe('Events routes', () => {
  let app: ReturnType<typeof createApp>;
  let repo: EventRepository;

  beforeEach(() => {
    repo = createMockRepository();
    const config = loadConfig({
      port: 0,
      databaseUrl: 'postgresql://localhost:5432/test',
      corsOrigins: ['http://localhost:5173'],
    });
    app = createApp(config, repo);
  });

  describe('POST /v1/events/batch', () => {
    it('accepts a batch of valid events', async () => {
      const { default: request } = await import('supertest');
      const events = [makeEvent(), makeEvent({ id: '0192e000-1000-7000-8000-000000000002' })];

      const res = await request(app)
        .post('/v1/events/batch')
        .send(events);

      expect(res.status).toBe(201);
      expect(res.body).toEqual({ accepted: 2 });
    });

    it('returns 0 accepted for empty batch', async () => {
      const { default: request } = await import('supertest');
      const res = await request(app)
        .post('/v1/events/batch')
        .send([]);

      expect(res.status).toBe(201);
      expect(res.body).toEqual({ accepted: 0 });
    });

    it('rejects non-array body with 400', async () => {
      const { default: request } = await import('supertest');
      const res = await request(app)
        .post('/v1/events/batch')
        .send({ single: 'object' });

      expect(res.status).toBe(400);
    });
  });

  describe('GET /v1/events', () => {
    it('returns paginated results', async () => {
      const { default: request } = await import('supertest');
      const events = Array.from({ length: 10 }, (_, i) =>
        makeEvent({ id: `0192e000-1000-7000-8000-${String(i).padStart(12, '0')}` }),
      );

      (repo.insertBatch as jest.Mock).mockResolvedValueOnce(10);
      (repo.findAll as jest.Mock).mockResolvedValueOnce({
        data: events,
        nextCursor: events[events.length - 1]?.id ?? null,
      });

      const res = await request(app).get('/v1/events?limit=10');

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(10);
      expect(res.body.nextCursor).toBeTruthy();
    });

    it('passes filters to repository', async () => {
      const { default: request } = await import('supertest');
      const res = await request(app).get(
        '/v1/events?agentName=test-agent&status=success&limit=5',
      );

      expect(res.status).toBe(200);
      expect(repo.findAll).toHaveBeenCalledWith(
        expect.objectContaining({ agentName: 'test-agent', status: 'success' }),
        expect.objectContaining({ limit: 5 }),
      );
    });

    it('passes cursor to repository', async () => {
      const { default: request } = await import('supertest');
      const res = await request(app).get('/v1/events?cursor=abc-123&limit=10');

      expect(res.status).toBe(200);
      expect(repo.findAll).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ cursor: 'abc-123' }),
      );
    });
  });
});
