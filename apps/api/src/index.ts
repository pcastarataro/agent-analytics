import type { EventRepository } from '@agent-analytics/database';
import { EVENT_SCHEMA_PACKAGE_NAME } from '@agent-analytics/event-schema';
import { SHARED_PACKAGE_NAME } from '@agent-analytics/shared';

import { createApp } from './server';
import { loadConfig } from './config';

export const API_PACKAGE_NAME = '@agent-analytics/api';

export function dependencyPackageNames(): string[] {
  return [EVENT_SCHEMA_PACKAGE_NAME, SHARED_PACKAGE_NAME];
}

export function bootstrap(repository: EventRepository) {
  const config = loadConfig();
  const app = createApp(config, repository);
  app.listen(config.port, () => {
    console.log(`[api] listening on port ${config.port}`);
  });
}
