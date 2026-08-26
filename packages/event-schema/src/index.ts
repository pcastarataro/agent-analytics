export const EVENT_SCHEMA_PACKAGE_NAME = '@agent-analytics/event-schema';

export function packageName(): string {
  return EVENT_SCHEMA_PACKAGE_NAME;
}

export * from './ids';
export * from './schemas';
