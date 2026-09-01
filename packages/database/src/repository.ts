import { eq, and, gte, lte, sql, type SQL, isNull, isNotNull } from 'drizzle-orm';
import { createHash } from 'node:crypto';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';

import type { UsageEvent } from '@agent-analytics/event-schema';

import { usageEvents, definitions, type UsageEventInsert } from './schema';

export interface DateFilters {
  from?: Date;
  to?: Date;
}

export interface EventFilters extends DateFilters {
  agentName?: string;
  sessionId?: string;
  status?: string;
}

export interface Pagination {
  limit: number;
  cursor?: string;
}

export interface PaginatedResult<T> {
  data: T[];
  nextCursor: string | null;
}

export interface UsageMetrics {
  totalEvents: number;
  distinctSessions: number;
  distinctExecutions: number;
  agentInvocations: number;
  skillInvocations: number;
  toolCalls: number;
}

export interface PerformanceMetrics {
  totalDurationMs: number;
  avgDurationMs: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCachedTokens: number;
  totalCost: number;
  avgCost: number;
}

export interface QualityMetrics {
  successCount: number;
  errorCount: number;
  cancelledCount: number;
  totalRetries: number;
  successRate: number;
  errorRate: number;
}

export interface AgentVersionMetrics {
  version: string;
  count: number;
  successCount: number;
  avgDurationMs: number;
  totalCost: number;
}

export interface SkillVersionMetrics {
  version: string;
  count: number;
  successCount: number;
  totalCost: number;
}

export interface EvolutionMetrics {
  byAgentVersion: AgentVersionMetrics[];
  bySkillVersion: SkillVersionMetrics[];
}

export interface SessionSummary {
  sessionId: string;
  eventCount: number;
  startedAt: Date;
  lastEventAt: Date;
  totalDurationMs: number;
  agentName: string | null;
  eventTypes: string[];
}

export interface SessionDetail {
  session: SessionSummary;
  events: UsageEvent[];
}

export interface AgentStat {
  agentName: string;
  version: string;
  executionCount: number;
  successRate: number;
  avgDurationMs: number;
  avgCost: number;
  totalCost: number;
}

export interface SkillStat {
  skillName: string;
  version: string;
  executionCount: number;
  successRate: number;
  avgCost: number;
  totalCost: number;
}

export interface UserStat {
  userId: string;
  eventCount: number;
  distinctAgents: number;
  distinctSkills: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCachedTokens: number;
  totalCost: number;
  firstSeenAt: Date;
  lastSeenAt: Date;
}

export interface MetricsAggregation {
  usage: UsageMetrics;
  performance: PerformanceMetrics;
  quality: QualityMetrics;
  evolution: EvolutionMetrics;
  byAgent: Record<string, number>;
  byStatus: Record<string, number>;
  byDate: Record<string, number>;
}

export interface AgentDetail {
  agentName: string;
  totalEvents: number;
  successRate: number;
  avgDurationMs: number;
  totalCost: number;
  avgCost: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCachedTokens: number;
  distinctVersions: number;
  byVersion: Array<{ version: string; executionCount: number; successRate: number; totalCost: number }>;
  eventsOverTime: Array<{ date: string; count: number }>;
  tokensBySkill: Array<{ name: string; tokens: number }>;
  recentEvents: UsageEvent[];
}

export interface SkillDetail {
  skillName: string;
  totalEvents: number;
  successRate: number;
  avgCost: number;
  totalCost: number;
  distinctVersions: number;
  byVersion: Array<{ version: string; executionCount: number; successRate: number; totalCost: number }>;
  eventsOverTime: Array<{ date: string; count: number }>;
  costByDate: Array<{ date: string; cost: number }>;
  recentEvents: UsageEvent[];
}

export interface UserDetail {
  userId: string;
  totalEvents: number;
  totalCost: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCachedTokens: number;
  firstSeenAt: Date;
  lastSeenAt: Date;
  agentsUsed: Array<{ name: string; count: number }>;
  skillsUsed: Array<{ name: string; count: number; totalCost: number }>;
  eventsOverTime: Array<{ date: string; count: number }>;
  costByDate: Array<{ date: string; cost: number }>;
  recentEvents: UsageEvent[];
}

export interface Definition {
  hash: string;
  content: string;
  entityType: string;
  entityName: string;
  version: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface SkillVersion {
  skillName: string;
  definitionHash: string;
  version: string | null;
  content: string;
  createdAt: Date;
  executionCount: number;
  successRate: number;
  avgCost: number;
  totalCost: number;
}

export interface ProjectStat {
  projectName: string;
  eventCount: number;
  successRate: number;
  avgDurationMs: number;
  avgCost: number;
  totalCost: number;
  distinctBranches: number;
  distinctAgents: number;
  firstSeenAt: Date;
  lastSeenAt: Date;
}

export interface ProjectDetail {
  projectName: string;
  totalEvents: number;
  successRate: number;
  avgDurationMs: number;
  totalCost: number;
  avgCost: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCachedTokens: number;
  distinctBranches: number;
  distinctAgents: number;
  byBranch: Array<{ branch: string; eventCount: number; totalCost: number }>;
  byAgent: Array<{ name: string; eventCount: number; totalCost: number }>;
  eventsOverTime: Array<{ date: string; count: number }>;
  recentEvents: UsageEvent[];
}

export interface BranchStat {
  branch: string;
  eventCount: number;
  successRate: number;
  avgDurationMs: number;
  avgCost: number;
  totalCost: number;
  distinctProjects: number;
  distinctAgents: number;
  firstSeenAt: Date;
  lastSeenAt: Date;
}

export interface BranchDetail {
  branch: string;
  totalEvents: number;
  successRate: number;
  avgDurationMs: number;
  totalCost: number;
  avgCost: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCachedTokens: number;
  distinctProjects: number;
  distinctAgents: number;
  byProject: Array<{ name: string; eventCount: number; totalCost: number }>;
  byAgent: Array<{ name: string; eventCount: number; totalCost: number }>;
  eventsOverTime: Array<{ date: string; count: number }>;
  costByDate: Array<{ date: string; cost: number }>;
  recentEvents: UsageEvent[];
}

export interface EventRepository {
  insertBatch(events: UsageEvent[]): Promise<number>;
  findById(id: string): Promise<UsageEvent | null>;
  findAll(filters: EventFilters, pagination: Pagination): Promise<PaginatedResult<UsageEvent>>;
  countByGroup(
    groupBy: 'agentName' | 'sessionId' | 'status',
    filters?: DateFilters,
  ): Promise<Record<string, number>>;
  countByDate(filters?: DateFilters): Promise<Record<string, number>>;
  getMetricsAggregation(filters?: DateFilters): Promise<MetricsAggregation>;
  getAgentStats(filters?: DateFilters): Promise<AgentStat[]>;
  getSkillStats(filters?: DateFilters): Promise<SkillStat[]>;
  getUserStats(filters?: DateFilters): Promise<UserStat[]>;
  findSessionList(
    pagination: Pagination,
    agentName?: string,
  ): Promise<PaginatedResult<SessionSummary>>;
  findSessionEvents(sessionId: string): Promise<SessionDetail | null>;
  getAgentDetail(agentName: string): Promise<AgentDetail | null>;
  getSkillDetail(skillName: string): Promise<SkillDetail | null>;
  getUserDetail(userId: string): Promise<UserDetail | null>;
  getDefinitionByHash(hash: string): Promise<Definition | null>;
  upsertDefinition(hash: string, content: string, entityType: string, entityName: string, version?: string | null): Promise<void>;
  getDefinitionsByEntity(entityType: string, entityName: string): Promise<Definition[]>;
  getAllDefinitions(): Promise<Definition[]>;
  getSkillVersions(filters?: DateFilters): Promise<SkillVersion[]>;
  getUsedEntityNames(): Promise<{ skills: string[]; agents: string[] }>;
  getProjectStats(filters?: DateFilters): Promise<ProjectStat[]>;
  getProjectByName(projectName: string): Promise<ProjectDetail | null>;
  getBranchStats(filters?: DateFilters): Promise<BranchStat[]>;
  getBranchByName(branch: string): Promise<BranchDetail | null>;
}

export function generateContentHash(event: UsageEvent): string {
  const dedupFields = JSON.stringify({
    id: event.id,
    traceId: event.execution.traceId,
    parentId: event.execution.parentId,
    eventType: (event.execution as Record<string, unknown>).eventType,
    agentName: event.agent.name,
    toolName: event.tool?.name,
    skillName: event.skill?.name,
    status: event.result.status,
    timestamp: event.timestamp,
  });
  return createHash('sha256').update(dedupFields).digest('hex').slice(0, 32);
}

function toRow(event: UsageEvent): UsageEventInsert {
  return {
    id: event.id,
    actor: event.actor as Record<string, unknown>,
    project: event.project as Record<string, unknown>,
    session: event.session as Record<string, unknown>,
    execution: event.execution as Record<string, unknown>,
    agent: event.agent as Record<string, unknown>,
    skill: event.skill as Record<string, unknown>,
    tool: event.tool as Record<string, unknown>,
    model: event.model as Record<string, unknown>,
    metrics: event.metrics as Record<string, unknown>,
    result: event.result as Record<string, unknown>,
    agentName: event.agent.name,
    sessionId: event.execution.traceId,
    eventType: (event.execution as Record<string, unknown>).eventType as string | undefined,
    timestamp: event.timestamp ? new Date(event.timestamp) : new Date(),
    status: event.result.status,
    contentHash: generateContentHash(event),
  };
}

function toEvent(row: Record<string, unknown>): UsageEvent {
  const execution = row.execution as UsageEvent['execution'];
  return {
    id: row.id as string,
    actor: row.actor as UsageEvent['actor'],
    project: row.project as UsageEvent['project'],
    session: row.session as UsageEvent['session'],
    execution: row.eventType
      ? { ...execution, eventType: row.eventType as UsageEvent['execution']['eventType'] }
      : execution,
    agent: row.agent as UsageEvent['agent'],
    skill: row.skill as UsageEvent['skill'],
    tool: row.tool as UsageEvent['tool'],
    model: row.model as UsageEvent['model'],
    metrics: row.metrics as UsageEvent['metrics'],
    result: row.result as UsageEvent['result'],
    timestamp: row.timestamp instanceof Date ? row.timestamp.toISOString() : (row.timestamp as string | undefined),
  };
}

export function createDrizzleRepository(
  db: PostgresJsDatabase<Record<string, never>>,
): EventRepository {
  function buildWhereClause(filters: EventFilters): SQL | undefined {
    const conditions: SQL[] = [];
    if (filters.agentName !== undefined) {
      conditions.push(eq(usageEvents.agentName, filters.agentName));
    }
    if (filters.sessionId !== undefined) {
      conditions.push(eq(usageEvents.sessionId, filters.sessionId));
    }
    if (filters.status !== undefined) {
      conditions.push(eq(usageEvents.status, filters.status));
    }
    if (filters.from !== undefined) {
      conditions.push(gte(usageEvents.timestamp, filters.from));
    }
    if (filters.to !== undefined) {
      conditions.push(lte(usageEvents.timestamp, filters.to));
    }
    return conditions.length > 0 ? and(...conditions) : undefined;
  }

  return {
    async insertBatch(events: UsageEvent[]): Promise<number> {
      if (events.length === 0) return 0;
      const rows = events.map(toRow);
      await db.insert(usageEvents).values(rows).onConflictDoNothing({ target: usageEvents.contentHash });
      return rows.length;
    },

    async findById(id: string): Promise<UsageEvent | null> {
      const [row] = await db.select().from(usageEvents).where(eq(usageEvents.id, id)).limit(1);
      return row !== undefined ? toEvent(row) : null;
    },

    async findAll(
      filters: EventFilters,
      pagination: Pagination,
    ): Promise<PaginatedResult<UsageEvent>> {
      const whereClause = buildWhereClause(filters);

      const cursorCondition =
        pagination.cursor !== undefined ? sql`${usageEvents.id} > ${pagination.cursor}` : undefined;

      const combinedWhere =
        whereClause !== undefined && cursorCondition !== undefined
          ? and(whereClause, cursorCondition)
          : (whereClause ?? cursorCondition);

      const baseQuery = db
        .select()
        .from(usageEvents)
        .orderBy(usageEvents.id)
        .limit(pagination.limit + 1);

      const rows =
        combinedWhere !== undefined ? await baseQuery.where(combinedWhere) : await baseQuery;

      const hasMore = rows.length > pagination.limit;
      const data = rows.slice(0, pagination.limit).map(toEvent);
      const nextCursor = hasMore && data.length > 0 ? data[data.length - 1]!.id : null;

      return { data, nextCursor };
    },

    async countByGroup(
      groupBy: 'agentName' | 'sessionId' | 'status',
      filters?: DateFilters,
    ): Promise<Record<string, number>> {
      const columnMap = {
        agentName: usageEvents.agentName,
        sessionId: usageEvents.sessionId,
        status: usageEvents.status,
      } as const;

      const column = columnMap[groupBy];
      if (!column) {
        throw new Error(`Unsupported groupBy column: ${groupBy}`);
      }

      const conditions: SQL[] = [];
      if (filters?.from !== undefined) {
        conditions.push(gte(usageEvents.timestamp, filters.from));
      }
      if (filters?.to !== undefined) {
        conditions.push(lte(usageEvents.timestamp, filters.to));
      }
      // Filter out unknown agents
      if (groupBy === 'agentName') {
        conditions.push(sql`(${usageEvents.agentName}) IS NOT NULL AND (${usageEvents.agentName}) != 'unknown'`);
      }

      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

      const baseQuery = db
        .select({ key: column, count: sql<number>`count(*)::int` })
        .from(usageEvents)
        .groupBy(column);

      const rows = whereClause !== undefined ? await baseQuery.where(whereClause) : await baseQuery;

      const result: Record<string, number> = {};
      for (const row of rows) {
        result[row.key ?? 'unknown'] = row.count;
      }
      return result;
    },

    async countByDate(filters?: DateFilters): Promise<Record<string, number>> {
      const dateColumn = sql<string>`to_char(${usageEvents.timestamp}, 'YYYY-MM-DD')`;

      const conditions: SQL[] = [];
      if (filters?.from !== undefined) {
        conditions.push(gte(usageEvents.timestamp, filters.from));
      }
      if (filters?.to !== undefined) {
        conditions.push(lte(usageEvents.timestamp, filters.to));
      }

      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

      const baseQuery = db
        .select({ key: dateColumn, count: sql<number>`count(*)::int` })
        .from(usageEvents)
        .groupBy(dateColumn)
        .orderBy(dateColumn);

      const rows = whereClause !== undefined ? await baseQuery.where(whereClause) : await baseQuery;

      const result: Record<string, number> = {};
      for (const row of rows) {
        result[row.key] = row.count;
      }
      return result;
    },

    async getMetricsAggregation(filters?: DateFilters): Promise<MetricsAggregation> {
      const conditions: SQL[] = [];
      if (filters?.from !== undefined) {
        conditions.push(gte(usageEvents.timestamp, filters.from));
      }
      if (filters?.to !== undefined) {
        conditions.push(lte(usageEvents.timestamp, filters.to));
      }
      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

      // --- Usage ---
      const usageRow = await db
        .select({
          totalEvents: sql<number>`count(*)::int`,
          distinctSessions: sql<number>`count(distinct ${usageEvents.sessionId})::int`,
          distinctExecutions: sql<number>`count(distinct (${usageEvents.execution}::jsonb->>'traceId'))::int`,
          agentInvocations: sql<number>`count(*) filter (where ${usageEvents.agentName} != 'unknown')::int`,
          skillInvocations: sql<number>`count(*) filter (where (${usageEvents.skill}::jsonb->>'name') is not null and (${usageEvents.skill}::jsonb->>'name') != 'unknown')::int`,
          toolCalls: sql<number>`count(*) filter (where (${usageEvents.tool}::jsonb->>'name') is not null and (${usageEvents.tool}::jsonb->>'name') != '')::int`,
        })
        .from(usageEvents)
        .where(whereClause ?? undefined);

      const usage: UsageMetrics = {
        totalEvents: usageRow[0]?.totalEvents ?? 0,
        distinctSessions: usageRow[0]?.distinctSessions ?? 0,
        distinctExecutions: usageRow[0]?.distinctExecutions ?? 0,
        agentInvocations: usageRow[0]?.agentInvocations ?? 0,
        skillInvocations: usageRow[0]?.skillInvocations ?? 0,
        toolCalls: usageRow[0]?.toolCalls ?? 0,
      };

      // --- Performance ---
      const perfRow = await db
        .select({
          totalDurationMs: sql<number>`coalesce(sum((${usageEvents.metrics}::jsonb->>'durationMs')::bigint), 0)::bigint`,
          avgDurationMs: sql<number>`coalesce(avg((${usageEvents.metrics}::jsonb->>'durationMs')::bigint), 0)::bigint`,
          totalInputTokens: sql<number>`coalesce(sum((${usageEvents.metrics}::jsonb->>'inputTokens')::bigint), 0)::bigint`,
          totalOutputTokens: sql<number>`coalesce(sum((${usageEvents.metrics}::jsonb->>'outputTokens')::bigint), 0)::bigint`,
          totalCachedTokens: sql<number>`coalesce(sum((${usageEvents.metrics}::jsonb->>'cachedTokens')::bigint), 0)::bigint`,
          totalCost: sql<number>`coalesce(sum((${usageEvents.metrics}::jsonb->>'cost')::numeric), 0)::numeric`,
          avgCost: sql<number>`coalesce(avg((${usageEvents.metrics}::jsonb->>'cost')::numeric), 0)::numeric`,
        })
        .from(usageEvents)
        .where(whereClause ?? undefined);

      const perf = perfRow[0];
      const performance: PerformanceMetrics = {
        totalDurationMs: Number(perf?.totalDurationMs ?? 0),
        avgDurationMs: Number(perf?.avgDurationMs ?? 0),
        totalInputTokens: Number(perf?.totalInputTokens ?? 0),
        totalOutputTokens: Number(perf?.totalOutputTokens ?? 0),
        totalCachedTokens: Number(perf?.totalCachedTokens ?? 0),
        totalCost: Number(perf?.totalCost ?? 0),
        avgCost: Number(perf?.avgCost ?? 0),
      };

      // --- Quality ---
      const qualityRow = await db
        .select({
          successCount: sql<number>`count(*) filter (where ${usageEvents.status} = 'success')::int`,
          errorCount: sql<number>`count(*) filter (where ${usageEvents.status} = 'error')::int`,
          cancelledCount: sql<number>`count(*) filter (where ${usageEvents.status} = 'cancelled')::int`,
          totalRetries: sql<number>`coalesce(sum((${usageEvents.metrics}::jsonb->>'retries')::int), 0)::int`,
          totalEvents: sql<number>`count(*)::int`,
        })
        .from(usageEvents)
        .where(whereClause ?? undefined);

      const q = qualityRow[0];
      const total = q?.totalEvents ?? 0;
      const quality: QualityMetrics = {
        successCount: q?.successCount ?? 0,
        errorCount: q?.errorCount ?? 0,
        cancelledCount: q?.cancelledCount ?? 0,
        totalRetries: q?.totalRetries ?? 0,
        successRate: total > 0 ? ((q?.successCount ?? 0) / total) * 100 : 0,
        errorRate: total > 0 ? ((q?.errorCount ?? 0) / total) * 100 : 0,
      };

      // --- Evolution: by agent version ---
      const agentVersionRows = await db
        .select({
          version: sql<string>`coalesce(${usageEvents.agent}::jsonb->>'version', 'unknown')`,
          count: sql<number>`count(*)::int`,
          successCount: sql<number>`count(*) filter (where ${usageEvents.status} = 'success')::int`,
          avgDurationMs: sql<number>`coalesce(avg((${usageEvents.metrics}::jsonb->>'durationMs')::bigint), 0)::bigint`,
          totalCost: sql<number>`coalesce(sum((${usageEvents.metrics}::jsonb->>'cost')::numeric), 0)::numeric`,
        })
        .from(usageEvents)
        .where(whereClause ?? undefined)
        .groupBy(sql`${usageEvents.agent}::jsonb->>'version'`);

      const byAgentVersion: AgentVersionMetrics[] = agentVersionRows.map((row) => ({
        version: row.version,
        count: row.count,
        successCount: row.successCount,
        avgDurationMs: Number(row.avgDurationMs),
        totalCost: Number(row.totalCost),
      }));

      // --- Evolution: by skill version ---
      const skillVersionRows = await db
        .select({
          version: sql<string>`coalesce(${usageEvents.skill}::jsonb->>'version', 'unknown')`,
          count: sql<number>`count(*)::int`,
          successCount: sql<number>`count(*) filter (where ${usageEvents.status} = 'success')::int`,
          totalCost: sql<number>`coalesce(sum((${usageEvents.metrics}::jsonb->>'cost')::numeric), 0)::numeric`,
        })
        .from(usageEvents)
        .where(whereClause ?? undefined)
        .groupBy(sql`${usageEvents.skill}::jsonb->>'version'`);

      const bySkillVersion: SkillVersionMetrics[] = skillVersionRows.map((row) => ({
        version: row.version,
        count: row.count,
        successCount: row.successCount,
        totalCost: Number(row.totalCost),
      }));

      const evolution: EvolutionMetrics = { byAgentVersion, bySkillVersion };

      // --- byAgent + byStatus + byDate (reuse existing methods) ---
      const [byAgent, byStatus, byDate] = await Promise.all([
        this.countByGroup('agentName', filters),
        this.countByGroup('status', filters),
        this.countByDate(filters),
      ]);

      return { usage, performance, quality, evolution, byAgent, byStatus, byDate };
    },

    async findSessionList(
      pagination: Pagination,
      agentName?: string,
    ): Promise<PaginatedResult<SessionSummary>> {
      const conditions: SQL[] = [isNotNull(usageEvents.sessionId)];
      if (agentName !== undefined) {
        conditions.push(eq(usageEvents.agentName, agentName));
      }
      const whereClause = and(...conditions);

      // Subquery to compute session-level aggregates, then paginate
      // Cursor is a timestamp; we paginate by lastEventAt < cursor
      let cursorCondition: SQL | undefined;
      if (pagination.cursor !== undefined) {
        cursorCondition = sql`max(${usageEvents.timestamp}) < ${new Date(pagination.cursor)}`;
      }

      const finalWhere =
        cursorCondition !== undefined ? and(whereClause, cursorCondition) : whereClause;

      const rows = await db
        .select({
          sessionId: usageEvents.sessionId,
          eventCount: sql<number>`count(*)::int`,
          startedAt: sql<Date>`min(${usageEvents.timestamp})`,
          lastEventAt: sql<Date>`max(${usageEvents.timestamp})`,
          agentName: sql<string | null>`max(${usageEvents.agentName})`,
          totalDurationMs: sql<number>`coalesce(sum(case when ${usageEvents.eventType} = 'assistant_message' then (${usageEvents.metrics}::jsonb->>'durationMs')::bigint else 0 end), 0)::bigint`,
          eventTypes: sql<string[]>`array_agg(distinct ${usageEvents.eventType})`,
        })
        .from(usageEvents)
        .where(finalWhere)
        .groupBy(usageEvents.sessionId)
        .orderBy(sql`max(${usageEvents.timestamp}) desc`)
        .limit(pagination.limit + 1);

      const hasMore = rows.length > pagination.limit;
      const data = rows.slice(0, pagination.limit).map((row) => ({
        sessionId: row.sessionId!,
        eventCount: row.eventCount,
        startedAt: row.startedAt,
        lastEventAt: row.lastEventAt,
        totalDurationMs: Number(row.totalDurationMs),
        agentName: row.agentName,
        eventTypes: row.eventTypes.filter(Boolean),
      }));
      const nextCursor = hasMore && data.length > 0
        ? data[data.length - 1]!.lastEventAt.toISOString()
        : null;

      return { data, nextCursor };
    },

    async findSessionEvents(sessionId: string): Promise<SessionDetail | null> {
      // First get the session summary
      const summaryRows = await db
        .select({
          sessionId: usageEvents.sessionId,
          eventCount: sql<number>`count(*)::int`,
          startedAt: sql<Date>`min(${usageEvents.timestamp})`,
          lastEventAt: sql<Date>`max(${usageEvents.timestamp})`,
          agentName: sql<string | null>`max(${usageEvents.agentName})`,
          totalDurationMs: sql<number>`coalesce(sum(case when ${usageEvents.eventType} = 'assistant_message' then (${usageEvents.metrics}::jsonb->>'durationMs')::bigint else 0 end), 0)::bigint`,
          eventTypes: sql<string[]>`array_agg(distinct ${usageEvents.eventType})`,
        })
        .from(usageEvents)
        .where(eq(usageEvents.sessionId, sessionId))
        .groupBy(usageEvents.sessionId);

      const summaryRow = summaryRows[0];
      if (!summaryRow) return null;

      // Then get all events for the session
      const eventRows = await db
        .select()
        .from(usageEvents)
        .where(eq(usageEvents.sessionId, sessionId))
        .orderBy(usageEvents.timestamp, usageEvents.id);

      return {
        session: {
          sessionId: summaryRow.sessionId!,
          eventCount: summaryRow.eventCount,
          startedAt: summaryRow.startedAt,
          lastEventAt: summaryRow.lastEventAt,
          totalDurationMs: Number(summaryRow.totalDurationMs),
          agentName: summaryRow.agentName,
          eventTypes: summaryRow.eventTypes.filter(Boolean),
        },
        events: eventRows.map(toEvent),
      };
    },

    async getAgentStats(filters?: DateFilters): Promise<AgentStat[]> {
      const conditions: SQL[] = [];
      if (filters?.from !== undefined) {
        conditions.push(gte(usageEvents.timestamp, filters.from));
      }
      if (filters?.to !== undefined) {
        conditions.push(lte(usageEvents.timestamp, filters.to));
      }
      conditions.push(
        sql`(${usageEvents.agentName}) IS NOT NULL AND (${usageEvents.agentName}) != 'unknown'`,
      );
      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

      const rows = await db
        .select({
          agentName: usageEvents.agentName,
          version: sql<string>`coalesce(${usageEvents.agent}::jsonb->>'version', 'unknown')`,
          executionCount: sql<number>`count(*)::int`,
          successRate: sql<number>`coalesce(count(*) filter (where ${usageEvents.status} = 'success') * 100.0 / nullif(count(*), 0), 0)`,
          avgDurationMs: sql<number>`coalesce(avg((${usageEvents.metrics}::jsonb->>'durationMs')::bigint), 0)::bigint`,
          avgCost: sql<number>`coalesce(avg((${usageEvents.metrics}::jsonb->>'cost')::numeric), 0)::numeric`,
          totalCost: sql<number>`coalesce(sum((${usageEvents.metrics}::jsonb->>'cost')::numeric), 0)::numeric`,
        })
        .from(usageEvents)
        .where(whereClause ?? undefined)
        .groupBy(usageEvents.agentName, sql`${usageEvents.agent}::jsonb->>'version'`)
        .orderBy(sql`count(*) desc`);

      return rows.map((row) => ({
        agentName: row.agentName ?? 'unknown',
        version: row.version,
        executionCount: row.executionCount,
        successRate: Number(row.successRate),
        avgDurationMs: Number(row.avgDurationMs),
        avgCost: Number(row.avgCost),
        totalCost: Number(row.totalCost),
      }));
    },

    async getSkillStats(filters?: DateFilters): Promise<SkillStat[]> {
      const conditions: SQL[] = [];
      if (filters?.from !== undefined) {
        conditions.push(gte(usageEvents.timestamp, filters.from));
      }
      if (filters?.to !== undefined) {
        conditions.push(lte(usageEvents.timestamp, filters.to));
      }
      conditions.push(
        sql`(${usageEvents.skill}::jsonb->>'name') IS NOT NULL AND (${usageEvents.skill}::jsonb->>'name') != 'unknown'`,
      );
      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

      const rows = await db
        .select({
          skillName: sql<string>`coalesce(${usageEvents.skill}::jsonb->>'name', 'unknown')`,
          version: sql<string>`coalesce(${usageEvents.skill}::jsonb->>'version', 'unknown')`,
          executionCount: sql<number>`count(*)::int`,
          successRate: sql<number>`coalesce(count(*) filter (where ${usageEvents.status} = 'success') * 100.0 / nullif(count(*), 0), 0)`,
          avgCost: sql<number>`coalesce(avg((${usageEvents.metrics}::jsonb->>'cost')::numeric), 0)::numeric`,
          totalCost: sql<number>`coalesce(sum((${usageEvents.metrics}::jsonb->>'cost')::numeric), 0)::numeric`,
        })
        .from(usageEvents)
        .where(whereClause ?? undefined)
        .groupBy(sql`${usageEvents.skill}::jsonb->>'name'`, sql`${usageEvents.skill}::jsonb->>'version'`)
        .orderBy(sql`count(*) desc`);

      return rows.map((row) => ({
        skillName: row.skillName,
        version: row.version,
        executionCount: row.executionCount,
        successRate: Number(row.successRate),
        avgCost: Number(row.avgCost),
        totalCost: Number(row.totalCost),
      }));
    },

    async getUserStats(filters?: DateFilters): Promise<UserStat[]> {
      const conditions: SQL[] = [];
      if (filters?.from !== undefined) {
        conditions.push(gte(usageEvents.timestamp, filters.from));
      }
      if (filters?.to !== undefined) {
        conditions.push(lte(usageEvents.timestamp, filters.to));
      }
      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

      const rows = await db
        .select({
          userId: sql<string>`coalesce(nullif(${usageEvents.actor}::jsonb->>'userId', ''), 'unknown')`,
          eventCount: sql<number>`count(*)::int`,
          distinctAgents: sql<number>`count(distinct ${usageEvents.agentName})::int`,
          distinctSkills: sql<number>`count(distinct (${usageEvents.skill}::jsonb->>'name'))::int`,
          totalInputTokens: sql<number>`coalesce(sum((${usageEvents.metrics}::jsonb->>'inputTokens')::bigint), 0)::bigint`,
          totalOutputTokens: sql<number>`coalesce(sum((${usageEvents.metrics}::jsonb->>'outputTokens')::bigint), 0)::bigint`,
          totalCachedTokens: sql<number>`coalesce(sum((${usageEvents.metrics}::jsonb->>'cachedTokens')::bigint), 0)::bigint`,
          totalCost: sql<number>`coalesce(sum((${usageEvents.metrics}::jsonb->>'cost')::numeric), 0)::numeric`,
          firstSeenAt: sql<Date>`min(${usageEvents.timestamp})`,
          lastSeenAt: sql<Date>`max(${usageEvents.timestamp})`,
        })
        .from(usageEvents)
        .where(whereClause ?? undefined)
        .groupBy(sql`${usageEvents.actor}::jsonb->>'userId'`)
        .orderBy(sql`count(*) desc`);

      return rows.map((row) => ({
        userId: row.userId,
        eventCount: row.eventCount,
        distinctAgents: row.distinctAgents,
        distinctSkills: row.distinctSkills,
        totalInputTokens: Number(row.totalInputTokens),
        totalOutputTokens: Number(row.totalOutputTokens),
        totalCachedTokens: Number(row.totalCachedTokens),
        totalCost: Number(row.totalCost),
        firstSeenAt: row.firstSeenAt instanceof Date ? row.firstSeenAt : new Date(row.firstSeenAt),
        lastSeenAt: row.lastSeenAt instanceof Date ? row.lastSeenAt : new Date(row.lastSeenAt),
      }));
    },

    async getAgentDetail(agentName: string): Promise<AgentDetail | null> {
      const where = eq(usageEvents.agentName, agentName);

      const statsRow = await db
        .select({
          totalEvents: sql<number>`count(*)::int`,
          successRate: sql<number>`coalesce(count(*) filter (where ${usageEvents.status} = 'success') * 100.0 / nullif(count(*), 0), 0)`,
          avgDurationMs: sql<number>`coalesce(avg((${usageEvents.metrics}::jsonb->>'durationMs')::bigint), 0)::bigint`,
          totalCost: sql<number>`coalesce(sum((${usageEvents.metrics}::jsonb->>'cost')::numeric), 0)::numeric`,
          avgCost: sql<number>`coalesce(avg((${usageEvents.metrics}::jsonb->>'cost')::numeric), 0)::numeric`,
          totalInputTokens: sql<number>`coalesce(sum((${usageEvents.metrics}::jsonb->>'inputTokens')::bigint), 0)::bigint`,
          totalOutputTokens: sql<number>`coalesce(sum((${usageEvents.metrics}::jsonb->>'outputTokens')::bigint), 0)::bigint`,
          totalCachedTokens: sql<number>`coalesce(sum((${usageEvents.metrics}::jsonb->>'cachedTokens')::bigint), 0)::bigint`,
        })
        .from(usageEvents)
        .where(where);

      const stats = statsRow[0];
      if (!stats || stats.totalEvents === 0) return null;

      const dateColumn = sql<string>`to_char(${usageEvents.timestamp}, 'YYYY-MM-DD')`;

      const eventsOverTimeRows = await db
        .select({ date: dateColumn, count: sql<number>`count(*)::int` })
        .from(usageEvents)
        .where(where)
        .groupBy(dateColumn)
        .orderBy(dateColumn);

      const tokensBySkillRows = await db
        .select({
          name: sql<string>`coalesce(${usageEvents.skill}::jsonb->>'name', 'unknown')`,
          tokens: sql<number>`coalesce(sum((${usageEvents.metrics}::jsonb->>'inputTokens')::bigint + (${usageEvents.metrics}::jsonb->>'outputTokens')::bigint), 0)::bigint`,
        })
        .from(usageEvents)
        .where(where)
        .groupBy(sql`${usageEvents.skill}::jsonb->>'name'`)
        .orderBy(sql`sum((${usageEvents.metrics}::jsonb->>'inputTokens')::bigint + (${usageEvents.metrics}::jsonb->>'outputTokens')::bigint) desc`);

      const byVersionRows = await db
        .select({
          version: sql<string>`coalesce(${usageEvents.agent}::jsonb->>'version', 'unknown')`,
          executionCount: sql<number>`count(*)::int`,
          successRate: sql<number>`coalesce(count(*) filter (where ${usageEvents.status} = 'success') * 100.0 / nullif(count(*), 0), 0)`,
          totalCost: sql<number>`coalesce(sum((${usageEvents.metrics}::jsonb->>'cost')::numeric), 0)::numeric`,
        })
        .from(usageEvents)
        .where(where)
        .groupBy(sql`${usageEvents.agent}::jsonb->>'version'`)
        .orderBy(sql`count(*) desc`);

      const byVersion = byVersionRows.map((row) => ({
        version: row.version,
        executionCount: row.executionCount,
        successRate: Number(row.successRate),
        totalCost: Number(row.totalCost),
      }));

      const recentRows = await db
        .select()
        .from(usageEvents)
        .where(where)
        .orderBy(usageEvents.timestamp)
        .limit(20);

      return {
        agentName,
        totalEvents: stats.totalEvents,
        successRate: Number(stats.successRate),
        avgDurationMs: Number(stats.avgDurationMs),
        totalCost: Number(stats.totalCost),
        avgCost: Number(stats.avgCost),
        totalInputTokens: Number(stats.totalInputTokens),
        totalOutputTokens: Number(stats.totalOutputTokens),
        totalCachedTokens: Number(stats.totalCachedTokens),
        distinctVersions: byVersion.length,
        byVersion,
        eventsOverTime: eventsOverTimeRows.map((r) => ({ date: r.date, count: r.count })),
        tokensBySkill: tokensBySkillRows.map((r) => ({ name: r.name, tokens: Number(r.tokens) })),
        recentEvents: recentRows.map(toEvent),
      };
    },

    async getSkillDetail(skillName: string): Promise<SkillDetail | null> {
      const where = sql`(${usageEvents.skill}::jsonb->>'name') = ${skillName}`;

      const statsRow = await db
        .select({
          totalEvents: sql<number>`count(*)::int`,
          successRate: sql<number>`coalesce(count(*) filter (where ${usageEvents.status} = 'success') * 100.0 / nullif(count(*), 0), 0)`,
          avgCost: sql<number>`coalesce(avg((${usageEvents.metrics}::jsonb->>'cost')::numeric), 0)::numeric`,
          totalCost: sql<number>`coalesce(sum((${usageEvents.metrics}::jsonb->>'cost')::numeric), 0)::numeric`,
        })
        .from(usageEvents)
        .where(where);

      const stats = statsRow[0];
      if (!stats || stats.totalEvents === 0) return null;

      const dateColumn = sql<string>`to_char(${usageEvents.timestamp}, 'YYYY-MM-DD')`;

      const eventsOverTimeRows = await db
        .select({ date: dateColumn, count: sql<number>`count(*)::int` })
        .from(usageEvents)
        .where(where)
        .groupBy(dateColumn)
        .orderBy(dateColumn);

      const costByDateRows = await db
        .select({
          date: dateColumn,
          cost: sql<number>`coalesce(sum((${usageEvents.metrics}::jsonb->>'cost')::numeric), 0)::numeric`,
        })
        .from(usageEvents)
        .where(where)
        .groupBy(dateColumn)
        .orderBy(dateColumn);

      const byVersionRows = await db
        .select({
          version: sql<string>`coalesce(${usageEvents.skill}::jsonb->>'version', 'unknown')`,
          executionCount: sql<number>`count(*)::int`,
          successRate: sql<number>`coalesce(count(*) filter (where ${usageEvents.status} = 'success') * 100.0 / nullif(count(*), 0), 0)`,
          totalCost: sql<number>`coalesce(sum((${usageEvents.metrics}::jsonb->>'cost')::numeric), 0)::numeric`,
        })
        .from(usageEvents)
        .where(where)
        .groupBy(sql`${usageEvents.skill}::jsonb->>'version'`)
        .orderBy(sql`count(*) desc`);

      const byVersion = byVersionRows.map((row) => ({
        version: row.version,
        executionCount: row.executionCount,
        successRate: Number(row.successRate),
        totalCost: Number(row.totalCost),
      }));

      const recentRows = await db
        .select()
        .from(usageEvents)
        .where(where)
        .orderBy(usageEvents.timestamp)
        .limit(20);

      return {
        skillName,
        totalEvents: stats.totalEvents,
        successRate: Number(stats.successRate),
        avgCost: Number(stats.avgCost),
        totalCost: Number(stats.totalCost),
        distinctVersions: byVersion.length,
        byVersion,
        eventsOverTime: eventsOverTimeRows.map((r) => ({ date: r.date, count: r.count })),
        costByDate: costByDateRows.map((r) => ({ date: r.date, cost: Number(r.cost) })),
        recentEvents: recentRows.map(toEvent),
      };
    },

    async getUserDetail(userId: string): Promise<UserDetail | null> {
      const where = sql`coalesce(nullif(${usageEvents.actor}::jsonb->>'userId', ''), 'unknown') = ${userId}`;

      const statsRow = await db
        .select({
          totalEvents: sql<number>`count(*)::int`,
          totalCost: sql<number>`coalesce(sum((${usageEvents.metrics}::jsonb->>'cost')::numeric), 0)::numeric`,
          totalInputTokens: sql<number>`coalesce(sum((${usageEvents.metrics}::jsonb->>'inputTokens')::bigint), 0)::bigint`,
          totalOutputTokens: sql<number>`coalesce(sum((${usageEvents.metrics}::jsonb->>'outputTokens')::bigint), 0)::bigint`,
          totalCachedTokens: sql<number>`coalesce(sum((${usageEvents.metrics}::jsonb->>'cachedTokens')::bigint), 0)::bigint`,
          firstSeenAt: sql<Date>`min(${usageEvents.timestamp})`,
          lastSeenAt: sql<Date>`max(${usageEvents.timestamp})`,
        })
        .from(usageEvents)
        .where(where);

      const stats = statsRow[0];
      if (!stats || stats.totalEvents === 0) return null;

      const dateColumn = sql<string>`to_char(${usageEvents.timestamp}, 'YYYY-MM-DD')`;

      const eventsOverTimeRows = await db
        .select({ date: dateColumn, count: sql<number>`count(*)::int` })
        .from(usageEvents)
        .where(where)
        .groupBy(dateColumn)
        .orderBy(dateColumn);

      const agentsUsedRows = await db
        .select({
          name: sql<string>`${usageEvents.agentName}`,
          count: sql<number>`count(*)::int`,
          totalCost: sql<number>`coalesce(sum((${usageEvents.metrics}::jsonb->>'cost')::numeric), 0)::numeric`,
        })
        .from(usageEvents)
        .where(and(where, sql`(${usageEvents.agentName}) IS NOT NULL AND (${usageEvents.agentName}) != 'unknown'`))
        .groupBy(usageEvents.agentName)
        .orderBy(sql`count(*) desc`);

      const skillsUsedRows = await db
        .select({
          name: sql<string>`${usageEvents.skill}::jsonb->>'name'`,
          count: sql<number>`count(*)::int`,
          totalCost: sql<number>`coalesce(sum((${usageEvents.metrics}::jsonb->>'cost')::numeric), 0)::numeric`,
        })
        .from(usageEvents)
        .where(sql`(${usageEvents.skill}::jsonb->>'name') IS NOT NULL AND (${usageEvents.skill}::jsonb->>'name') != 'unknown'`)
        .groupBy(sql`${usageEvents.skill}::jsonb->>'name'`)
        .orderBy(sql`count(*) desc`);

      const costByDateRows = await db
        .select({
          date: dateColumn,
          cost: sql<number>`coalesce(sum((${usageEvents.metrics}::jsonb->>'cost')::numeric), 0)::numeric`,
        })
        .from(usageEvents)
        .where(where)
        .groupBy(dateColumn)
        .orderBy(dateColumn);

      const recentRows = await db
        .select()
        .from(usageEvents)
        .where(where)
        .orderBy(usageEvents.timestamp)
        .limit(20);

      return {
        userId,
        totalEvents: stats.totalEvents,
        totalCost: Number(stats.totalCost),
        totalInputTokens: Number(stats.totalInputTokens),
        totalOutputTokens: Number(stats.totalOutputTokens),
        totalCachedTokens: Number(stats.totalCachedTokens),
        firstSeenAt: stats.firstSeenAt instanceof Date ? stats.firstSeenAt : new Date(stats.firstSeenAt),
        lastSeenAt: stats.lastSeenAt instanceof Date ? stats.lastSeenAt : new Date(stats.lastSeenAt),
        agentsUsed: agentsUsedRows.map((r) => ({ name: r.name ?? 'unknown', count: r.count, totalCost: Number(r.totalCost) })),
        skillsUsed: skillsUsedRows.map((r) => ({ name: r.name, count: r.count, totalCost: Number(r.totalCost) })),
        eventsOverTime: eventsOverTimeRows.map((r) => ({ date: r.date, count: r.count })),
        costByDate: costByDateRows.map((r) => ({ date: r.date, cost: Number(r.cost) })),
        recentEvents: recentRows.map(toEvent),
      };
    },

    async getDefinitionByHash(hash: string): Promise<Definition | null> {
      const [row] = await db.select().from(definitions).where(eq(definitions.hash, hash)).limit(1);
      if (!row) return null;
      return {
        hash: row.hash,
        content: row.content,
        entityType: row.entityType,
        entityName: row.entityName,
        version: row.version,
        createdAt: row.createdAt instanceof Date ? row.createdAt : new Date(row.createdAt),
        updatedAt: row.updatedAt instanceof Date ? row.updatedAt : new Date(row.updatedAt),
      };
    },

    async upsertDefinition(
      hash: string,
      content: string,
      entityType: string,
      entityName: string,
      version?: string | null,
    ): Promise<void> {
      await db
        .insert(definitions)
        .values({ hash, content, entityType, entityName, version: version ?? null })
        .onConflictDoUpdate({
          target: definitions.hash,
          set: { content, entityType, entityName, version: version ?? null, updatedAt: new Date() },
        });
    },

    async getDefinitionsByEntity(entityType: string, entityName: string): Promise<Definition[]> {
      const rows = await db
        .select()
        .from(definitions)
        .where(and(eq(definitions.entityType, entityType), eq(definitions.entityName, entityName)))
        .orderBy(definitions.updatedAt);
      return rows.map((row) => ({
        hash: row.hash,
        content: row.content,
        entityType: row.entityType,
        entityName: row.entityName,
        version: row.version,
        createdAt: row.createdAt instanceof Date ? row.createdAt : new Date(row.createdAt),
        updatedAt: row.updatedAt instanceof Date ? row.updatedAt : new Date(row.updatedAt),
      }));
    },

    async getAllDefinitions(): Promise<Definition[]> {
      const rows = await db
        .select()
        .from(definitions)
        .orderBy(definitions.updatedAt);
      return rows.map((row) => ({
        hash: row.hash,
        content: row.content,
        entityType: row.entityType,
        entityName: row.entityName,
        version: row.version,
        createdAt: row.createdAt instanceof Date ? row.createdAt : new Date(row.createdAt),
        updatedAt: row.updatedAt instanceof Date ? row.updatedAt : new Date(row.updatedAt),
      }));
    },

    async getSkillVersions(filters?: DateFilters): Promise<SkillVersion[]> {
      // Get all skill definitions
      const skillDefs = await db
        .select()
        .from(definitions)
        .where(eq(definitions.entityType, 'skill'))
        .orderBy(definitions.entityName, definitions.updatedAt);

      // Get usage stats grouped by (skillName, definitionHash)
      const conditions: SQL[] = [];
      if (filters?.from !== undefined) {
        conditions.push(gte(usageEvents.timestamp, filters.from));
      }
      if (filters?.to !== undefined) {
        conditions.push(lte(usageEvents.timestamp, filters.to));
      }
      conditions.push(
        sql`(${usageEvents.skill}::jsonb->>'name') IS NOT NULL AND (${usageEvents.skill}::jsonb->>'name') != 'unknown'`,
      );
      conditions.push(
        sql`(${usageEvents.skill}::jsonb->>'definitionHash') IS NOT NULL`,
      );
      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

      const statsRows = await db
        .select({
          skillName: sql<string>`${usageEvents.skill}::jsonb->>'name'`,
          definitionHash: sql<string>`${usageEvents.skill}::jsonb->>'definitionHash'`,
          executionCount: sql<number>`count(*)::int`,
          successRate: sql<number>`coalesce(count(*) filter (where ${usageEvents.status} = 'success') * 100.0 / nullif(count(*), 0), 0)`,
          avgCost: sql<number>`coalesce(avg((${usageEvents.metrics}::jsonb->>'cost')::numeric), 0)::numeric`,
          totalCost: sql<number>`coalesce(sum((${usageEvents.metrics}::jsonb->>'cost')::numeric), 0)::numeric`,
        })
        .from(usageEvents)
        .where(whereClause ?? undefined)
        .groupBy(sql`${usageEvents.skill}::jsonb->>'name'`, sql`${usageEvents.skill}::jsonb->>'definitionHash'`);

      // Build a map of stats by definitionHash
      const statsMap = new Map<string, { executionCount: number; successRate: number; avgCost: number; totalCost: number }>();
      for (const row of statsRows) {
        statsMap.set(row.definitionHash, {
          executionCount: row.executionCount,
          successRate: Number(row.successRate),
          avgCost: Number(row.avgCost),
          totalCost: Number(row.totalCost),
        });
      }

      // Combine definitions with stats
      return skillDefs.map((def) => {
        const stats = statsMap.get(def.hash);
        return {
          skillName: def.entityName,
          definitionHash: def.hash,
          version: def.version,
          content: def.content,
          createdAt: def.createdAt instanceof Date ? def.createdAt : new Date(def.createdAt),
          executionCount: stats?.executionCount ?? 0,
          successRate: stats?.successRate ?? 0,
          avgCost: stats?.avgCost ?? 0,
          totalCost: stats?.totalCost ?? 0,
        };
      });
    },

    async getUsedEntityNames(): Promise<{ skills: string[]; agents: string[] }> {
      const skillRows = await db
        .selectDistinct({ name: sql<string>`${usageEvents.skill}::jsonb->>'name'` })
        .from(usageEvents)
        .where(sql`(${usageEvents.skill}::jsonb->>'name') IS NOT NULL AND (${usageEvents.skill}::jsonb->>'name') != 'unknown'`);

      const agentRows = await db
        .selectDistinct({ name: sql<string>`${usageEvents.agent}::jsonb->>'name'` })
        .from(usageEvents)
        .where(sql`(${usageEvents.agent}::jsonb->>'name') IS NOT NULL AND (${usageEvents.agent}::jsonb->>'name') != 'unknown'`);

      return {
        skills: skillRows.map((r) => r.name).filter(Boolean),
        agents: agentRows.map((r) => r.name).filter(Boolean),
      };
    },

    async getProjectStats(filters?: DateFilters): Promise<ProjectStat[]> {
      const conditions: SQL[] = [];
      if (filters?.from !== undefined) {
        conditions.push(gte(usageEvents.timestamp, filters.from));
      }
      if (filters?.to !== undefined) {
        conditions.push(lte(usageEvents.timestamp, filters.to));
      }
      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

      const rows = await db
        .select({
          projectName: usageEvents.projectName,
          eventCount: sql<number>`count(*)::int`,
          successRate: sql<number>`coalesce(count(*) filter (where ${usageEvents.status} = 'success') * 100.0 / nullif(count(*), 0), 0)`,
          avgDurationMs: sql<number>`coalesce(avg((${usageEvents.metrics}::jsonb->>'durationMs')::bigint), 0)::bigint`,
          avgCost: sql<number>`coalesce(avg((${usageEvents.metrics}::jsonb->>'cost')::numeric), 0)::numeric`,
          totalCost: sql<number>`coalesce(sum((${usageEvents.metrics}::jsonb->>'cost')::numeric), 0)::numeric`,
          distinctBranches: sql<number>`count(distinct ${usageEvents.projectBranch})::int`,
          distinctAgents: sql<number>`count(distinct ${usageEvents.agentName})::int`,
          firstSeenAt: sql<Date>`min(${usageEvents.timestamp})`,
          lastSeenAt: sql<Date>`max(${usageEvents.timestamp})`,
        })
        .from(usageEvents)
        .where(whereClause ?? undefined)
        .groupBy(usageEvents.projectName)
        .orderBy(sql`count(*) desc`);

      return rows.map((row) => ({
        projectName: row.projectName ?? 'unknown',
        eventCount: row.eventCount,
        successRate: Number(row.successRate),
        avgDurationMs: Number(row.avgDurationMs),
        avgCost: Number(row.avgCost),
        totalCost: Number(row.totalCost),
        distinctBranches: row.distinctBranches,
        distinctAgents: row.distinctAgents,
        firstSeenAt: row.firstSeenAt instanceof Date ? row.firstSeenAt : new Date(row.firstSeenAt),
        lastSeenAt: row.lastSeenAt instanceof Date ? row.lastSeenAt : new Date(row.lastSeenAt),
      }));
    },

    async getProjectByName(projectName: string): Promise<ProjectDetail | null> {
      const where = eq(usageEvents.projectName, projectName);

      const statsRow = await db
        .select({
          totalEvents: sql<number>`count(*)::int`,
          successRate: sql<number>`coalesce(count(*) filter (where ${usageEvents.status} = 'success') * 100.0 / nullif(count(*), 0), 0)`,
          avgDurationMs: sql<number>`coalesce(avg((${usageEvents.metrics}::jsonb->>'durationMs')::bigint), 0)::bigint`,
          totalCost: sql<number>`coalesce(sum((${usageEvents.metrics}::jsonb->>'cost')::numeric), 0)::numeric`,
          avgCost: sql<number>`coalesce(avg((${usageEvents.metrics}::jsonb->>'cost')::numeric), 0)::numeric`,
          totalInputTokens: sql<number>`coalesce(sum((${usageEvents.metrics}::jsonb->>'inputTokens')::bigint), 0)::bigint`,
          totalOutputTokens: sql<number>`coalesce(sum((${usageEvents.metrics}::jsonb->>'outputTokens')::bigint), 0)::bigint`,
          totalCachedTokens: sql<number>`coalesce(sum((${usageEvents.metrics}::jsonb->>'cachedTokens')::bigint), 0)::bigint`,
          distinctBranches: sql<number>`count(distinct ${usageEvents.projectBranch})::int`,
          distinctAgents: sql<number>`count(distinct ${usageEvents.agentName})::int`,
        })
        .from(usageEvents)
        .where(where);

      const stats = statsRow[0];
      if (!stats || stats.totalEvents === 0) return null;

      const dateColumn = sql<string>`to_char(${usageEvents.timestamp}, 'YYYY-MM-DD')`;

      const byBranchRows = await db
        .select({
          branch: usageEvents.projectBranch,
          eventCount: sql<number>`count(*)::int`,
          totalCost: sql<number>`coalesce(sum((${usageEvents.metrics}::jsonb->>'cost')::numeric), 0)::numeric`,
        })
        .from(usageEvents)
        .where(where)
        .groupBy(usageEvents.projectBranch)
        .orderBy(sql`count(*) desc`);

      const byAgentRows = await db
        .select({
          name: sql<string>`coalesce(${usageEvents.agentName}, 'unknown')`,
          eventCount: sql<number>`count(*)::int`,
          totalCost: sql<number>`coalesce(sum((${usageEvents.metrics}::jsonb->>'cost')::numeric), 0)::numeric`,
        })
        .from(usageEvents)
        .where(and(where, sql`(${usageEvents.agentName}) IS NOT NULL AND (${usageEvents.agentName}) != 'unknown'`))
        .groupBy(usageEvents.agentName)
        .orderBy(sql`count(*) desc`);

      const eventsOverTimeRows = await db
        .select({ date: dateColumn, count: sql<number>`count(*)::int` })
        .from(usageEvents)
        .where(where)
        .groupBy(dateColumn)
        .orderBy(dateColumn);

      const recentRows = await db
        .select()
        .from(usageEvents)
        .where(where)
        .orderBy(usageEvents.timestamp)
        .limit(20);

      return {
        projectName,
        totalEvents: stats.totalEvents,
        successRate: Number(stats.successRate),
        avgDurationMs: Number(stats.avgDurationMs),
        totalCost: Number(stats.totalCost),
        avgCost: Number(stats.avgCost),
        totalInputTokens: Number(stats.totalInputTokens),
        totalOutputTokens: Number(stats.totalOutputTokens),
        totalCachedTokens: Number(stats.totalCachedTokens),
        distinctBranches: stats.distinctBranches,
        distinctAgents: stats.distinctAgents,
        byBranch: byBranchRows.map((r) => ({ branch: r.branch ?? 'unknown', eventCount: r.eventCount, totalCost: Number(r.totalCost) })),
        byAgent: byAgentRows.map((r) => ({ name: r.name, eventCount: r.eventCount, totalCost: Number(r.totalCost) })),
        eventsOverTime: eventsOverTimeRows.map((r) => ({ date: r.date, count: r.count })),
        recentEvents: recentRows.map(toEvent),
      };
    },

    async getBranchStats(filters?: DateFilters): Promise<BranchStat[]> {
      const conditions: SQL[] = [];
      if (filters?.from !== undefined) {
        conditions.push(gte(usageEvents.timestamp, filters.from));
      }
      if (filters?.to !== undefined) {
        conditions.push(lte(usageEvents.timestamp, filters.to));
      }
      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

      const rows = await db
        .select({
          branch: usageEvents.projectBranch,
          eventCount: sql<number>`count(*)::int`,
          successRate: sql<number>`coalesce(count(*) filter (where ${usageEvents.status} = 'success') * 100.0 / nullif(count(*), 0), 0)`,
          avgDurationMs: sql<number>`coalesce(avg((${usageEvents.metrics}::jsonb->>'durationMs')::bigint), 0)::bigint`,
          avgCost: sql<number>`coalesce(avg((${usageEvents.metrics}::jsonb->>'cost')::numeric), 0)::numeric`,
          totalCost: sql<number>`coalesce(sum((${usageEvents.metrics}::jsonb->>'cost')::numeric), 0)::numeric`,
          distinctProjects: sql<number>`count(distinct ${usageEvents.projectName})::int`,
          distinctAgents: sql<number>`count(distinct ${usageEvents.agentName})::int`,
          firstSeenAt: sql<Date>`min(${usageEvents.timestamp})`,
          lastSeenAt: sql<Date>`max(${usageEvents.timestamp})`,
        })
        .from(usageEvents)
        .where(whereClause ?? undefined)
        .groupBy(usageEvents.projectBranch)
        .orderBy(sql`count(*) desc`);

      return rows.map((row) => ({
        branch: row.branch ?? 'unknown',
        eventCount: row.eventCount,
        successRate: Number(row.successRate),
        avgDurationMs: Number(row.avgDurationMs),
        avgCost: Number(row.avgCost),
        totalCost: Number(row.totalCost),
        distinctProjects: row.distinctProjects,
        distinctAgents: row.distinctAgents,
        firstSeenAt: row.firstSeenAt instanceof Date ? row.firstSeenAt : new Date(row.firstSeenAt),
        lastSeenAt: row.lastSeenAt instanceof Date ? row.lastSeenAt : new Date(row.lastSeenAt),
      }));
    },

    async getBranchByName(branch: string): Promise<BranchDetail | null> {
      const where = eq(usageEvents.projectBranch, branch);

      const statsRow = await db
        .select({
          totalEvents: sql<number>`count(*)::int`,
          successRate: sql<number>`coalesce(count(*) filter (where ${usageEvents.status} = 'success') * 100.0 / nullif(count(*), 0), 0)`,
          avgDurationMs: sql<number>`coalesce(avg((${usageEvents.metrics}::jsonb->>'durationMs')::bigint), 0)::bigint`,
          totalCost: sql<number>`coalesce(sum((${usageEvents.metrics}::jsonb->>'cost')::numeric), 0)::numeric`,
          avgCost: sql<number>`coalesce(avg((${usageEvents.metrics}::jsonb->>'cost')::numeric), 0)::numeric`,
          totalInputTokens: sql<number>`coalesce(sum((${usageEvents.metrics}::jsonb->>'inputTokens')::bigint), 0)::bigint`,
          totalOutputTokens: sql<number>`coalesce(sum((${usageEvents.metrics}::jsonb->>'outputTokens')::bigint), 0)::bigint`,
          totalCachedTokens: sql<number>`coalesce(sum((${usageEvents.metrics}::jsonb->>'cachedTokens')::bigint), 0)::bigint`,
          distinctProjects: sql<number>`count(distinct ${usageEvents.projectName})::int`,
          distinctAgents: sql<number>`count(distinct ${usageEvents.agentName})::int`,
        })
        .from(usageEvents)
        .where(where);

      const stats = statsRow[0];
      if (!stats || stats.totalEvents === 0) return null;

      const dateColumn = sql<string>`to_char(${usageEvents.timestamp}, 'YYYY-MM-DD')`;

      const byProjectRows = await db
        .select({
          name: sql<string>`coalesce(${usageEvents.projectName}, 'unknown')`,
          eventCount: sql<number>`count(*)::int`,
          totalCost: sql<number>`coalesce(sum((${usageEvents.metrics}::jsonb->>'cost')::numeric), 0)::numeric`,
        })
        .from(usageEvents)
        .where(where)
        .groupBy(usageEvents.projectName)
        .orderBy(sql`count(*) desc`);

      const byAgentRows = await db
        .select({
          name: sql<string>`coalesce(${usageEvents.agentName}, 'unknown')`,
          eventCount: sql<number>`count(*)::int`,
          totalCost: sql<number>`coalesce(sum((${usageEvents.metrics}::jsonb->>'cost')::numeric), 0)::numeric`,
        })
        .from(usageEvents)
        .where(and(where, sql`(${usageEvents.agentName}) IS NOT NULL AND (${usageEvents.agentName}) != 'unknown'`))
        .groupBy(usageEvents.agentName)
        .orderBy(sql`count(*) desc`);

      const eventsOverTimeRows = await db
        .select({ date: dateColumn, count: sql<number>`count(*)::int` })
        .from(usageEvents)
        .where(where)
        .groupBy(dateColumn)
        .orderBy(dateColumn);

      const costByDateRows = await db
        .select({
          date: dateColumn,
          cost: sql<number>`coalesce(sum((${usageEvents.metrics}::jsonb->>'cost')::numeric), 0)::numeric`,
        })
        .from(usageEvents)
        .where(where)
        .groupBy(dateColumn)
        .orderBy(dateColumn);

      const recentRows = await db
        .select()
        .from(usageEvents)
        .where(where)
        .orderBy(usageEvents.timestamp)
        .limit(20);

      return {
        branch,
        totalEvents: stats.totalEvents,
        successRate: Number(stats.successRate),
        avgDurationMs: Number(stats.avgDurationMs),
        totalCost: Number(stats.totalCost),
        avgCost: Number(stats.avgCost),
        totalInputTokens: Number(stats.totalInputTokens),
        totalOutputTokens: Number(stats.totalOutputTokens),
        totalCachedTokens: Number(stats.totalCachedTokens),
        distinctProjects: stats.distinctProjects,
        distinctAgents: stats.distinctAgents,
        byProject: byProjectRows.map((r) => ({ name: r.name, eventCount: r.eventCount, totalCost: Number(r.totalCost) })),
        byAgent: byAgentRows.map((r) => ({ name: r.name, eventCount: r.eventCount, totalCost: Number(r.totalCost) })),
        eventsOverTime: eventsOverTimeRows.map((r) => ({ date: r.date, count: r.count })),
        costByDate: costByDateRows.map((r) => ({ date: r.date, cost: Number(r.cost) })),
        recentEvents: recentRows.map(toEvent),
      };
    },
  };
}
