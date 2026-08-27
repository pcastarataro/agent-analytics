import type { EventRepository, PaginatedResult } from '@agent-analytics/database';
import type { UsageEvent } from '@agent-analytics/event-schema';

import { createApp } from '../server';
import { loadConfig } from '../config';

function createMockRepository(): EventRepository {
  return {
    insertBatch: jest.fn().mockResolvedValue(0),
    findById: jest.fn().mockResolvedValue(null),
    findAll: jest
      .fn()
      .mockResolvedValue({ data: [], nextCursor: null } satisfies PaginatedResult<UsageEvent>),
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
    findSessionList: jest.fn().mockResolvedValue({ data: [], nextCursor: null }),
    findSessionEvents: jest.fn().mockResolvedValue(null),
  };
}

describe('API Server', () => {
  let app: ReturnType<typeof createApp>;
  let repo: EventRepository;

  beforeEach(() => {
    repo = createMockRepository();
    const config = loadConfig({
      port: 0,
      databaseUrl: 'postgresql://localhost:5432/test',
      corsOrigins: ['https://app.example.com'],
    });
    app = createApp(config, repo);
  });

  it('returns 200 on GET /health', async () => {
    const { default: request } = await import('supertest');
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok', timestamp: expect.any(String) });
  });

  it('rejects non-array body on POST /v1/events/batch', async () => {
    const { default: request } = await import('supertest');
    const res = await request(app).post('/v1/events/batch').send({ not: 'an array' });
    expect(res.status).toBe(400);
  });

  it('accepts empty array on POST /v1/events/batch', async () => {
    const { default: request } = await import('supertest');
    const res = await request(app).post('/v1/events/batch').send([]);
    expect(res.status).toBe(201);
    expect(res.body).toEqual({ accepted: 0 });
  });
});
