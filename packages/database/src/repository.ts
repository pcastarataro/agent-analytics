import { eq, and, gte, lte, sql, type SQL } from 'drizzle-orm';
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

export interface EventRepository {
  insertBatch(events: UsageEvent[]): Promise<number>;
  findById(id: string): Promise<UsageEvent | null>;
  findAll(filters: EventFilters, pagination: Pagination): Promise<PaginatedResult<UsageEvent>>;
  countByGroup(groupBy: 'agentName' | 'sessionId' | 'status', filters?: DateFilters): Promise<Record<string, number>>;
  countByDate(filters?: DateFilters): Promise<Record<string, number>>;
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
    timestamp: new Date(),
    status: event.result.status,
  };
}

function toEvent(row: Record<string, unknown>): UsageEvent {
  return {
    id: row.id as string,
    actor: row.actor as UsageEvent['actor'],
    project: row.project as UsageEvent['project'],
    session: row.session as UsageEvent['session'],
    execution: row.execution as UsageEvent['execution'],
    agent: row.agent as UsageEvent['agent'],
    skill: row.skill as UsageEvent['skill'],
    tool: row.tool as UsageEvent['tool'],
    model: row.model as UsageEvent['model'],
    metrics: row.metrics as UsageEvent['metrics'],
    result: row.result as UsageEvent['result'],
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
      await db
        .insert(usageEvents)
        .values(rows)
        .onConflictDoNothing({ target: usageEvents.id });
      return rows.length;
    },

    async findById(id: string): Promise<UsageEvent | null> {
      const [row] = await db
        .select()
        .from(usageEvents)
        .where(eq(usageEvents.id, id))
        .limit(1);
      return row !== undefined ? toEvent(row) : null;
    },

    async findAll(
      filters: EventFilters,
      pagination: Pagination,
    ): Promise<PaginatedResult<UsageEvent>> {
      const whereClause = buildWhereClause(filters);

      const cursorCondition =
        pagination.cursor !== undefined
          ? sql`${usageEvents.id} > ${pagination.cursor}`
          : undefined;

      const combinedWhere =
        whereClause !== undefined && cursorCondition !== undefined
          ? and(whereClause, cursorCondition)
          : whereClause ?? cursorCondition;

      const baseQuery = db
        .select()
        .from(usageEvents)
        .orderBy(usageEvents.id)
        .limit(pagination.limit + 1);

      const rows =
        combinedWhere !== undefined
          ? await baseQuery.where(combinedWhere)
          : await baseQuery;

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

      const rows =
        whereClause !== undefined
          ? await baseQuery.where(whereClause)
          : await baseQuery;

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

      const rows =
        whereClause !== undefined
          ? await baseQuery.where(whereClause)
          : await baseQuery;

      const result: Record<string, number> = {};
      for (const row of rows) {
        result[row.key] = row.count;
      }
      return result;
    },
  };
}
