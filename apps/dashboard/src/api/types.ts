export interface StatsOverview {
  total: number;
  byAgent: Record<string, number>;
  byStatus: Record<string, number>;
  byDate: Record<string, number>;
}

export interface UsageEventDTO {
  id: string;
  actor: { userId: string };
  project: Record<string, unknown>;
  session: Record<string, unknown>;
  execution: { traceId: string; parentId?: string };
  agent: { name: string; version?: string; definitionHash?: string };
  skill: { name: string; version?: string; definitionHash?: string };
  tool: Record<string, unknown>;
  model: Record<string, unknown>;
  metrics: {
    durationMs?: number;
    inputTokens?: number;
    outputTokens?: number;
    cachedTokens?: number;
    cost?: number;
  };
  result: { status: 'success' | 'error' | 'cancelled' };
}

export interface PaginatedEvents {
  data: UsageEventDTO[];
  nextCursor: string | null;
}

export interface EventFilters {
  agentName?: string;
  sessionId?: string;
  status?: string;
  from?: string;
  to?: string;
  limit?: number;
  cursor?: string;
}
