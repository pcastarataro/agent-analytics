import { OPENCODE_COLLECTOR_PACKAGE_NAME, dependencyPackageNames } from '../index';

describe('@agent-analytics/opencode-collector skeleton', () => {
  it('resolves its workspace dependencies by package name', () => {
    expect(dependencyPackageNames()).toEqual([
      '@agent-analytics/event-schema',
      '@agent-analytics/shared',
    ]);
  });

  it('exposes its package name', () => {
    expect(OPENCODE_COLLECTOR_PACKAGE_NAME).toBe('@agent-analytics/opencode-collector');
  });
});
