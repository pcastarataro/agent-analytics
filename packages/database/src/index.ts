export { usageEvents, type UsageEventRow, type UsageEventInsert } from './schema';
export {
  createDrizzleRepository,
  generateContentHash,
  type EventRepository,
  type EventFilters,
  type DateFilters,
  type Pagination,
  type PaginatedResult,
  type UsageMetrics,
  type PerformanceMetrics,
  type QualityMetrics,
  type AgentVersionMetrics,
  type SkillVersionMetrics,
  type EvolutionMetrics,
  type MetricsAggregation,
  type SessionSummary,
  type SessionDetail,
} from './repository';

export const DATABASE_PACKAGE_NAME = '@agent-analytics/database';

export function dependencyPackageNames(): string[] {
  return ['@agent-analytics/shared', '@agent-analytics/event-schema'];
}
