import type { EventRepository, Definition } from '@agent-analytics/database';

import { createApp } from '../server';
import { loadConfig } from '../config';

function createMockRepository(): EventRepository {
  const definitionsDb = new Map<string, Definition>();

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
    findSessionList: jest.fn().mockResolvedValue({ data: [], nextCursor: null }),
    findSessionEvents: jest.fn().mockResolvedValue(null),
    getAgentDetail: jest.fn().mockResolvedValue(null),
    getSkillDetail: jest.fn().mockResolvedValue(null),
    getUserDetail: jest.fn().mockResolvedValue(null),
    getDefinitionByHash: jest.fn().mockImplementation(async (hash: string) => {
      return definitionsDb.get(hash) ?? null;
    }),
    upsertDefinition: jest.fn().mockImplementation(async (hash: string, content: string, entityType: string, entityName: string, version?: string | null) => {
      const now = new Date();
      definitionsDb.set(hash, {
        hash,
        content,
        entityType,
        entityName,
        version: version ?? null,
        createdAt: now,
        updatedAt: now,
      });
    }),
    getDefinitionsByEntity: jest.fn().mockImplementation(async (entityType: string, entityName: string) => {
      return Array.from(definitionsDb.values()).filter(
        (d) => d.entityType === entityType && d.entityName === entityName,
      );
    }),
    getAllDefinitions: jest.fn().mockResolvedValue([]),
    getSkillVersions: jest.fn().mockResolvedValue([]),
    getUsedEntityNames: jest.fn().mockResolvedValue({ skills: [], agents: [] }),
    getProjectStats: jest.fn().mockResolvedValue([]),
    getProjectByName: jest.fn().mockResolvedValue(null),
    getBranchStats: jest.fn().mockResolvedValue([]),
    getBranchByName: jest.fn().mockResolvedValue(null),
  };
}

describe('PUT /v1/definitions/:hash with version', () => {
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

  it('persists version when provided and includes it in GET response', async () => {
    const { default: request } = await import('supertest');

    const putRes = await request(app)
      .put('/v1/definitions/abc123')
      .send({
        content: '## My Agent Config',
        entityType: 'agent',
        entityName: 'my-agent',
        version: '1.0.0',
      });

    expect(putRes.status).toBe(201);
    expect(putRes.body.version).toBe('1.0.0');
    expect(putRes.body.hash).toBe('abc123');
    expect(putRes.body.entityType).toBe('agent');
    expect(putRes.body.entityName).toBe('my-agent');
  });

  it('persists null version when not provided', async () => {
    const { default: request } = await import('supertest');

    const putRes = await request(app)
      .put('/v1/definitions/def456')
      .send({
        content: '## My Skill Config',
        entityType: 'skill',
        entityName: 'my-skill',
      });

    expect(putRes.status).toBe(201);
    expect(putRes.body.version).toBeNull();
  });

  it('GET /v1/definitions list includes version field', async () => {
    const { default: request } = await import('supertest');

    // Create two definitions with different versions
    await request(app)
      .put('/v1/definitions/hash-a')
      .send({
        content: 'Content A',
        entityType: 'agent',
        entityName: 'alpha',
        version: '1.0.0',
      });

    await request(app)
      .put('/v1/definitions/hash-b')
      .send({
        content: 'Content B',
        entityType: 'agent',
        entityName: 'alpha',
        version: '2.0.0',
      });

    const listRes = await request(app).get(
      '/v1/definitions?entityType=agent&entityName=alpha',
    );

    expect(listRes.status).toBe(200);
    expect(listRes.body.data).toHaveLength(2);
    expect(listRes.body.data.some((d: Definition) => d.version === '1.0.0')).toBe(true);
    expect(listRes.body.data.some((d: Definition) => d.version === '2.0.0')).toBe(true);
  });
});
