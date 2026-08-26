import { EVENT_SCHEMA_PACKAGE_NAME, packageName } from '../index';

describe('@agent-analytics/event-schema skeleton', () => {
  it('exposes its package name', () => {
    expect(packageName()).toBe(EVENT_SCHEMA_PACKAGE_NAME);
  });
});
