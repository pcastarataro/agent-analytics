import { eq, and, gte, lte, sql, type SQL, isNull, isNotNull } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';

import type { UsageEvent } from '@agent-analytics/event-schema';

import { usageEvents, type UsageEventInsert } from './schema';

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

export interface MetricsAggregation {
  usage: UsageMetrics;
  performance: PerformanceMetrics;
  quality: QualityMetrics;
  evolution: EvolutionMetrics;
  byAgent: Record<string, number>;
  byStatus: Record<string, number>;
  byDate: Record<string, number>;
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
  findSessionList(
    pagination: Pagination,
    agentName?: string,
  ): Promise<PaginatedResult<SessionSummary>>;
  findSessionEvents(sessionId: string): Promise<SessionDetail | null>;
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
      await db.insert(usageEvents).values(rows).onConflictDoNothing({ target: usageEvents.id });
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
  };
}
