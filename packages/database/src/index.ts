import { SHARED_PACKAGE_NAME } from '@agent-analytics/shared';

export const DATABASE_PACKAGE_NAME = '@agent-analytics/database';

export function dependencyPackageNames(): string[] {
  return [SHARED_PACKAGE_NAME];
}
