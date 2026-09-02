export { usageEvents, definitions, users, type UsageEventRow, type UsageEventInsert, type DefinitionRow, type DefinitionInsert, type UserRow, type UserInsert } from './schema';
export {
  createDrizzleRepository,
  createUserRepository,
  generateContentHash,
  type EventRepository,
  type UserRepository,
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
  type AgentStat,
  type SkillStat,
  type UserStat,
  type Definition,
  type ProjectStat,
  type ProjectDetail,
  type BranchStat,
  type BranchDetail,
} from './repository';

export const DATABASE_PACKAGE_NAME = '@agent-analytics/database';

export function dependencyPackageNames(): string[] {
  return ['@agent-analytics/shared', '@agent-analytics/event-schema'];
}
