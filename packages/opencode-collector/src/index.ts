import { EVENT_SCHEMA_PACKAGE_NAME } from '@agent-analytics/event-schema';
import { SHARED_PACKAGE_NAME } from '@agent-analytics/shared';

export const OPENCODE_COLLECTOR_PACKAGE_NAME = '@agent-analytics/opencode-collector';

export function dependencyPackageNames(): string[] {
  return [EVENT_SCHEMA_PACKAGE_NAME, SHARED_PACKAGE_NAME];
}
