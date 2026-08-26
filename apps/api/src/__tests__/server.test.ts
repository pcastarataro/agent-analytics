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
    expect(res.body).toEqual({ status: 'ok' });
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
