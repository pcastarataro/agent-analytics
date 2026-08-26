import { SHARED_PACKAGE_NAME } from '@agent-analytics/shared';

export const DASHBOARD_PACKAGE_NAME = '@agent-analytics/dashboard';

export function dependencyPackageNames(): string[] {
  return [SHARED_PACKAGE_NAME];
}
