import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';

import { createDrizzleRepository, createUserRepository } from '@agent-analytics/database';

import { bootstrap } from './index';
import { loadConfig } from './config';

async function main() {
  const config = loadConfig();

  const client = postgres(config.databaseUrl);
  const db = drizzle(client);

  // Schema migrations are handled by docker-entrypoint-initdb.d (postgres-init/001_init.sql)
  // For local dev without Docker, run: psql $DATABASE_URL -f packages/database/migrations/0000_initial.sql

  const repository = createDrizzleRepository(db);
  const userRepository = createUserRepository(db);

  bootstrap(repository, userRepository);
}

main().catch((err) => {
  console.error('[api] Failed to start:', err);
  process.exit(1);
});
