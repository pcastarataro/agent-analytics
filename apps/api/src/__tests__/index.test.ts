import { API_PACKAGE_NAME, dependencyPackageNames } from '../index';

describe('@agent-analytics/api skeleton', () => {
  it('resolves its workspace dependencies by package name', () => {
    expect(dependencyPackageNames()).toEqual([
      '@agent-analytics/event-schema',
      '@agent-analytics/shared',
    ]);
  });

  it('exposes its package name', () => {
    expect(API_PACKAGE_NAME).toBe('@agent-analytics/api');
  });
});
