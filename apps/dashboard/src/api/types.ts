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

export interface StatsOverview {
  usage: UsageMetrics;
  performance: PerformanceMetrics;
  quality: QualityMetrics;
  evolution: EvolutionMetrics;
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
  timestamp?: string;
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

export interface SessionSummary {
  sessionId: string;
  eventCount: number;
  startedAt: string;
  lastEventAt: string;
  totalDurationMs: number;
  agentName: string;
  eventTypes: string[];
}

export interface SessionEvent extends UsageEventDTO {
  eventType: string;
}

export interface SessionDetail {
  session: SessionSummary;
  events: SessionEvent[];
}

export interface PaginatedSessions {
  data: SessionSummary[];
  nextCursor: string | null;
}

export interface AgentStat {
  agentName: string;
  version: string;
  executionCount: number;
  successRate: number;
  avgDurationMs: number;
  totalCost: number;
}

export interface SkillStat {
  skillName: string;
  version: string;
  executionCount: number;
  successRate: number;
  totalCost: number;
}

export interface UserStat {
  userId: string;
  eventCount: number;
  distinctAgents: number;
  distinctSkills: number;
  firstSeenAt: string;
  lastSeenAt: string;
}
