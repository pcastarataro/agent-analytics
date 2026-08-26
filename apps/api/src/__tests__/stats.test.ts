import type { EventRepository, DateFilters } from '@agent-analytics/database';

import { createApp } from '../server';
import { loadConfig } from '../config';

function createMockRepository(): EventRepository {
  return {
    insertBatch: jest.fn().mockResolvedValue(0),
    findById: jest.fn().mockResolvedValue(null),
    findAll: jest.fn().mockResolvedValue({ data: [], nextCursor: null }),
    countByGroup: jest.fn().mockResolvedValue({}),
    countByDate: jest.fn().mockResolvedValue({}),
  };
}

describe('GET /v1/stats/overview', () => {
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

  it('returns full overview with all groups', async () => {
    const { default: request } = await import('supertest');

    (repo.countByGroup as jest.Mock)
      .mockResolvedValueOnce({ 'agent-a': 60, 'agent-b': 40 })
      .mockResolvedValueOnce({ success: 80, error: 20 });
    (repo.countByDate as jest.Mock).mockResolvedValue({
      '2026-01-01': 50,
      '2026-01-02': 50,
    });

    const res = await request(app).get('/v1/stats/overview');

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(100);
    expect(res.body.byAgent).toEqual({ 'agent-a': 60, 'agent-b': 40 });
    expect(res.body.byStatus).toEqual({ success: 80, error: 20 });
    expect(res.body.byDate).toEqual({ '2026-01-01': 50, '2026-01-02': 50 });
  });

  it('passes date range filters to repository', async () => {
    const { default: request } = await import('supertest');

    (repo.countByGroup as jest.Mock)
      .mockResolvedValueOnce({ 'agent-a': 30 })
      .mockResolvedValueOnce({ success: 30 });
    (repo.countByDate as jest.Mock).mockResolvedValue({ '2026-02-15': 30 });

    const res = await request(app).get(
      '/v1/stats/overview?from=2026-02-01T00:00:00Z&to=2026-02-28T23:59:59Z',
    );

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(30);

    const expectedFilters: DateFilters = {
      from: new Date('2026-02-01T00:00:00Z'),
      to: new Date('2026-02-28T23:59:59Z'),
    };
    expect(repo.countByGroup).toHaveBeenCalledWith('agentName', expectedFilters);
    expect(repo.countByGroup).toHaveBeenCalledWith('status', expectedFilters);
    expect(repo.countByDate).toHaveBeenCalledWith(expectedFilters);
  });

  it('returns empty result when no events match', async () => {
    const { default: request } = await import('supertest');

    (repo.countByGroup as jest.Mock)
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({});
    (repo.countByDate as jest.Mock).mockResolvedValue({});

    const res = await request(app).get('/v1/stats/overview');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      total: 0,
      byAgent: {},
      byStatus: {},
      byDate: {},
    });
  });
});
