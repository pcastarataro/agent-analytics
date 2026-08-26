export { usageEvents, type UsageEventRow, type UsageEventInsert } from './schema';
export {
  createDrizzleRepository,
  type EventRepository,
  type EventFilters,
  type DateFilters,
  type Pagination,
  type PaginatedResult,
} from './repository';

export const DATABASE_PACKAGE_NAME = '@agent-analytics/database';

export function dependencyPackageNames(): string[] {
  return ['@agent-analytics/shared', '@agent-analytics/event-schema'];
}
