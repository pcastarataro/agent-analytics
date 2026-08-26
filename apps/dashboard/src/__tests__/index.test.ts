import { DASHBOARD_PACKAGE_NAME, dependencyPackageNames } from '../index';

describe('@agent-analytics/dashboard skeleton', () => {
  it('resolves its workspace dependency by package name', () => {
    expect(dependencyPackageNames()).toEqual(['@agent-analytics/shared']);
  });

  it('exposes its package name', () => {
    expect(DASHBOARD_PACKAGE_NAME).toBe('@agent-analytics/dashboard');
  });
});
