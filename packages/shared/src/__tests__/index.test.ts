import { SHARED_PACKAGE_NAME, packageName } from '../index';

describe('@agent-analytics/shared skeleton', () => {
  it('exposes its package name', () => {
    expect(packageName()).toBe(SHARED_PACKAGE_NAME);
  });
});
