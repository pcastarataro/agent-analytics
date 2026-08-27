import type { EventRepository, DateFilters, MetricsAggregation, AgentStat, SkillStat, UserStat } from '@agent-analytics/database';

import { createApp } from '../server';
import { loadConfig } from '../config';

const emptyMetrics: MetricsAggregation = {
  usage: { totalEvents: 0, distinctSessions: 0, distinctExecutions: 0, agentInvocations: 0, skillInvocations: 0, toolCalls: 0 },
  performance: { totalDurationMs: 0, avgDurationMs: 0, totalInputTokens: 0, totalOutputTokens: 0, totalCachedTokens: 0, totalCost: 0, avgCost: 0 },
  quality: { successCount: 0, errorCount: 0, cancelledCount: 0, totalRetries: 0, successRate: 0, errorRate: 0 },
  evolution: { byAgentVersion: [], bySkillVersion: [] },
  byAgent: {},
  byStatus: {},
  byDate: {},
};

function createMockRepository(): EventRepository {
  return {
    insertBatch: jest.fn().mockResolvedValue(0),
    findById: jest.fn().mockResolvedValue(null),
    findAll: jest.fn().mockResolvedValue({ data: [], nextCursor: null }),
    countByGroup: jest.fn().mockResolvedValue({}),
    countByDate: jest.fn().mockResolvedValue({}),
    getMetricsAggregation: jest.fn().mockResolvedValue(emptyMetrics),
    getAgentStats: jest.fn().mockResolvedValue([]),
    getSkillStats: jest.fn().mockResolvedValue([]),
    getUserStats: jest.fn().mockResolvedValue([]),
    findSessionList: jest.fn().mockResolvedValue({ data: [], nextCursor: null }),
    findSessionEvents: jest.fn().mockResolvedValue(null),
    getAgentDetail: jest.fn().mockResolvedValue(null),
    getSkillDetail: jest.fn().mockResolvedValue(null),
    getUserDetail: jest.fn().mockResolvedValue(null),
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

  it('returns full overview with all metric groups', async () => {
    const { default: request } = await import('supertest');

    const mockResult: MetricsAggregation = {
      usage: { totalEvents: 100, distinctSessions: 15, distinctExecutions: 20, agentInvocations: 80, skillInvocations: 30, toolCalls: 50 },
      performance: { totalDurationMs: 50000, avgDurationMs: 500, totalInputTokens: 100000, totalOutputTokens: 50000, totalCachedTokens: 10000, totalCost: 12.5, avgCost: 0.125 },
      quality: { successCount: 80, errorCount: 15, cancelledCount: 5, totalRetries: 3, successRate: 80, errorRate: 15 },
      evolution: {
        byAgentVersion: [{ version: '1.0', count: 60, successCount: 55, avgDurationMs: 400, totalCost: 7.5 }],
        bySkillVersion: [{ version: '2.1', count: 30, successCount: 28, totalCost: 3.0 }],
      },
      byAgent: { 'agent-a': 60, 'agent-b': 40 },
      byStatus: { success: 80, error: 20 },
      byDate: { '2026-01-01': 50, '2026-01-02': 50 },
    };

    (repo.getMetricsAggregation as jest.Mock).mockResolvedValueOnce(mockResult);

    const res = await request(app).get('/v1/stats/overview');

    expect(res.status).toBe(200);
    expect(res.body.usage.totalEvents).toBe(100);
    expect(res.body.usage.distinctSessions).toBe(15);
    expect(res.body.performance.totalCost).toBe(12.5);
    expect(res.body.quality.successRate).toBe(80);
    expect(res.body.evolution.byAgentVersion).toHaveLength(1);
    expect(res.body.byAgent).toEqual({ 'agent-a': 60, 'agent-b': 40 });
    expect(res.body.byStatus).toEqual({ success: 80, error: 20 });
    expect(res.body.byDate).toEqual({ '2026-01-01': 50, '2026-01-02': 50 });
  });

  it('passes date range filters to repository', async () => {
    const { default: request } = await import('supertest');

    const expectedFilters: DateFilters = {
      from: new Date('2026-02-01T00:00:00Z'),
      to: new Date('2026-02-28T23:59:59Z'),
    };

    const res = await request(app).get(
      '/v1/stats/overview?from=2026-02-01T00:00:00Z&to=2026-02-28T23:59:59Z',
    );

    expect(res.status).toBe(200);
    expect(repo.getMetricsAggregation).toHaveBeenCalledWith(expectedFilters);
  });

  it('returns empty result when no events match', async () => {
    const { default: request } = await import('supertest');

    (repo.getMetricsAggregation as jest.Mock).mockResolvedValueOnce(emptyMetrics);

    const res = await request(app).get('/v1/stats/overview');

    expect(res.status).toBe(200);
    expect(res.body.usage.totalEvents).toBe(0);
    expect(res.body.byAgent).toEqual({});
  });
});

describe('GET /v1/stats/agents', () => {
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

  it('returns agent stats with correct shape', async () => {
    const { default: request } = await import('supertest');

    const mockResult: AgentStat[] = [
      { agentName: 'agent-a', version: '1.0.0', executionCount: 50, successRate: 80, avgDurationMs: 500, avgCost: 0.21, totalCost: 10.5 },
      { agentName: 'agent-b', version: '2.0.0', executionCount: 30, successRate: 90, avgDurationMs: 300, avgCost: 0.167, totalCost: 5.0 },
    ];

    (repo.getAgentStats as jest.Mock).mockResolvedValueOnce(mockResult);

    const res = await request(app).get('/v1/stats/agents');

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.data[0].agentName).toBe('agent-a');
    expect(res.body.data[0].executionCount).toBe(50);
    expect(res.body.data[1].agentName).toBe('agent-b');
  });

  it('passes date range filters to repository', async () => {
    const { default: request } = await import('supertest');

    const expectedFilters: DateFilters = {
      from: new Date('2026-03-01T00:00:00Z'),
      to: new Date('2026-03-31T23:59:59Z'),
    };

    const res = await request(app).get('/v1/stats/agents?from=2026-03-01T00:00:00Z&to=2026-03-31T23:59:59Z');

    expect(res.status).toBe(200);
    expect(repo.getAgentStats).toHaveBeenCalledWith(expectedFilters);
  });

  it('returns empty array when no events', async () => {
    const { default: request } = await import('supertest');

    (repo.getAgentStats as jest.Mock).mockResolvedValueOnce([]);

    const res = await request(app).get('/v1/stats/agents');

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
  });
});

describe('GET /v1/stats/skills', () => {
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

  it('returns skill stats with correct shape', async () => {
    const { default: request } = await import('supertest');

    const mockResult: SkillStat[] = [
      { skillName: 'skill-a', version: '1.0.0', executionCount: 40, successRate: 85, avgCost: 0.20, totalCost: 8.0 },
      { skillName: 'skill-b', version: '1.1.0', executionCount: 20, successRate: 95, avgCost: 0.175, totalCost: 3.5 },
    ];

    (repo.getSkillStats as jest.Mock).mockResolvedValueOnce(mockResult);

    const res = await request(app).get('/v1/stats/skills');

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.data[0].skillName).toBe('skill-a');
    expect(res.body.data[0].executionCount).toBe(40);
    expect(res.body.data[1].skillName).toBe('skill-b');
  });

  it('passes date range filters to repository', async () => {
    const { default: request } = await import('supertest');

    const expectedFilters: DateFilters = {
      from: new Date('2026-03-01T00:00:00Z'),
      to: new Date('2026-03-31T23:59:59Z'),
    };

    const res = await request(app).get('/v1/stats/skills?from=2026-03-01T00:00:00Z&to=2026-03-31T23:59:59Z');

    expect(res.status).toBe(200);
    expect(repo.getSkillStats).toHaveBeenCalledWith(expectedFilters);
  });

  it('returns empty array when no events', async () => {
    const { default: request } = await import('supertest');

    (repo.getSkillStats as jest.Mock).mockResolvedValueOnce([]);

    const res = await request(app).get('/v1/stats/skills');

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
  });
});

describe('GET /v1/stats/users', () => {
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

  it('returns user stats with correct shape', async () => {
    const { default: request } = await import('supertest');

    const mockResult: UserStat[] = [
      { userId: 'user-1', eventCount: 100, distinctAgents: 3, distinctSkills: 5, totalInputTokens: 10000, totalOutputTokens: 5000, totalCachedTokens: 2000, totalCost: 0.45, firstSeenAt: new Date('2026-01-01'), lastSeenAt: new Date('2026-01-15') },
      { userId: 'user-2', eventCount: 50, distinctAgents: 2, distinctSkills: 3, totalInputTokens: 3000, totalOutputTokens: 1500, totalCachedTokens: 800, totalCost: 0.12, firstSeenAt: new Date('2026-01-05'), lastSeenAt: new Date('2026-01-20') },
    ];

    (repo.getUserStats as jest.Mock).mockResolvedValueOnce(mockResult);

    const res = await request(app).get('/v1/stats/users');

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.data[0].userId).toBe('user-1');
    expect(res.body.data[0].eventCount).toBe(100);
    expect(res.body.data[1].userId).toBe('user-2');
  });

  it('passes date range filters to repository', async () => {
    const { default: request } = await import('supertest');

    const expectedFilters: DateFilters = {
      from: new Date('2026-03-01T00:00:00Z'),
      to: new Date('2026-03-31T23:59:59Z'),
    };

    const res = await request(app).get('/v1/stats/users?from=2026-03-01T00:00:00Z&to=2026-03-31T23:59:59Z');

    expect(res.status).toBe(200);
    expect(repo.getUserStats).toHaveBeenCalledWith(expectedFilters);
  });

  it('returns empty array when no events', async () => {
    const { default: request } = await import('supertest');

    (repo.getUserStats as jest.Mock).mockResolvedValueOnce([]);

    const res = await request(app).get('/v1/stats/users');

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
  });
});
