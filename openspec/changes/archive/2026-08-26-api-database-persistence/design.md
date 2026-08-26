# Design: api-database-persistence

## Technical Approach

Build a PostgreSQL persistence layer and Express API on top of the existing `@agent-analytics/event-schema` (zod schemas). Drizzle ORM maps TypeScript types to SQL without raw dialect fragments, preserving engine-agnosticism per `config.yaml`. Data flows: Collector → `POST /v1/events/batch` → zod validation → Drizzle insert → PostgreSQL. Query endpoints return cursor-paginated results and aggregated stats.

## Architecture Decisions

| Decision | Options | Tradeoff | Choice | Rationale |
|----------|---------|----------|--------|-----------|
| HTTP framework | Express vs Fastify | Express: ecosystem breadth, simpler mental model. Fastify: 2x throughput, schema-based validation. | **Express** | Proposal scope is small (<1k events/sec expected); Express's middleware model is more familiar; zod already handles validation. Performance not a bottleneck. |
| ORM | Drizzle vs Prisma vs Knex | Drizzle: SQL-like, no codegen, tree-shakeable. Prisma: migration tooling mature, but heavy codegen. Knex: query builder only, no schema. | **Drizzle ORM** | Proposal specifies Drizzle. Query-builder style keeps it close to SQL, no codegen step. `drizzle-kit` handles migrations. |
| DB driver | postgres.js vs pg | postgres.js: modern, Promise-based, edge-compatible. pg: legacy, callback roots. | **postgres.js** | Proposal specifies postgres.js. Cleaner API, better TypeScript support, lighter bundle. |
| JSONB strategy | Single JSONB vs column-per-group vs hybrid | Single JSONB: flexible but no indexing. Per-group: indexable but rigid. Hybrid: indexed top-level + JSONB nested. | **Hybrid** | Spec requires indexed top-level columns (`agentName`, `sessionId`, `timestamp`, `status`) + JSONB for nested groups (`execution`, `metrics`, etc.). Best of both. |
| UUID generation | DB-generated vs API-generated | DB: single source of truth. API: enables idempotent upsert before insert. | **API layer** | `UuidV7Schema` already in event-schema. Collector generates IDs; API validates and passes through. Enables `ON CONFLICT (id) DO NOTHING` idempotency. |
| Migrations | drizzle-kit push vs migrate | `push`: no SQL files, schema-first. `migrate`: SQL files, versioned. | **drizzle-kit migrate** | Produces versioned up/down SQL in `packages/database/migrations/`. Auditable, reversible, CI-friendly. |
| Validation | Zod at boundary vs Drizzle defaults | Zod: rich error messages, known schema. Drizzle: minimal, DB-focused. | **Zod at boundary** | Spec requires zod validation before route handlers. `usageEventSchema.parse()` rejects invalid payloads early; Drizzle inserts validated data only. |
| Error pattern | Global middleware vs per-route try/catch | Global: DRY, consistent shape. Per-route: explicit but verbose. | **Global middleware** | Express error middleware catches all unhandled throws. Returns `{ status, message, details? }` per spec. Route handlers stay clean. |
| Testing approach | Unit + integration + contract | Unit: fast, isolated. Integration: real DB, slower. Contract: proves zod↔Drizzle fidelity. | **All three** | Unit for middleware/validators. Integration with Docker PostgreSQL. Contract test mandatory per spec requirement. |

## Data Flow

```
Collector ──POST /v1/events/batch──▶ Express Server
                                       │
                                  validate body (zod.array)
                                       │
                                  ┌────┴────┐
                                  │ for each │
                                  │  event   │
                                  └────┬────┘
                              usageEventSchema.safeParse()
                                       │
                              ┌────────┴────────┐
                         valid ─────────── invalid → log + skip
                              │
                    repository.insertBatch(events)
                              │
                    INSERT INTO usage_events
                    ON CONFLICT (id) DO NOTHING
                              │
                         ┌────┴────┐
                         │  pg driver │
                         └────┬────┘
                              │
                    { accepted: N }
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `packages/database/src/schema.ts` | Create | Drizzle table definition for `usage_events` |
| `packages/database/src/repository.ts` | Create | Repository interface + Drizzle implementation |
| `packages/database/src/index.ts` | Modify | Re-export schema, repository, types |
| `packages/database/drizzle.config.ts` | Create | drizzle-kit configuration |
| `packages/database/migrations/` | Create | Up/down SQL for `usage_events` |
| `packages/database/src/__tests__/repository.test.ts` | Create | Integration tests + contract test |
| `packages/database/src/__tests__/schema.test.ts` | Create | Schema column/type tests |
| `apps/api/src/server.ts` | Create | Express app factory (middleware order, error handler) |
| `apps/api/src/config.ts` | Create | Environment-based config (PORT, DATABASE_URL, CORS_ORIGINS) |
| `apps/api/src/middleware/validate.ts` | Create | Zod validation middleware |
| `apps/api/src/middleware/error-handler.ts` | Create | Global error handler middleware |
| `apps/api/src/middleware/auth.ts` | Create | API key auth middleware (stub) |
| `apps/api/src/routes/events.ts` | Create | POST /v1/events/batch, GET /v1/events |
| `apps/api/src/routes/stats.ts` | Create | GET /v1/stats/overview |
| `apps/api/src/index.ts` | Modify | Server bootstrap entry point |
| `apps/api/src/__tests__/server.test.ts` | Create | Health check + middleware integration tests |
| `apps/api/src/__tests__/events.test.ts` | Create | Batch ingestion + query route tests |
| `packages/shared/src/errors.ts` | Create | Shared error types (ApiError, ValidationError) |
| `docker/docker-compose.yml` | Create | PostgreSQL dev service |
| Root `package.json` | Modify | Add workspace deps |

## Interfaces / Contracts

```typescript
// packages/database/src/schema.ts
export const usageEvents = pgTable('usage_events', {
  id:        uuid('id').primaryKey(),
  actor:     jsonb('actor'),
  project:   jsonb('project'),
  session:   jsonb('session'),
  execution: jsonb('execution'),
  agent:     jsonb('agent'),
  skill:     jsonb('skill'),
  tool:      jsonb('tool'),
  model:     jsonb('model'),
  metrics:   jsonb('metrics'),
  result:    jsonb('result'),
  agentName: text('agent_name'),
  sessionId: text('session_id'),
  timestamp: timestamp('timestamp', { withTimezone: true }),
  status:    text('status'),
}, (table) => [
  index('idx_agent_name').on(table.agentName),
  index('idx_session_id').on(table.sessionId),
  index('idx_timestamp').on(table.timestamp),
  index('idx_status').on(table.status),
]);

// packages/database/src/repository.ts
export interface EventRepository {
  insertBatch(events: UsageEvent[]): Promise<number>;
  findById(id: string): Promise<UsageEvent | null>;
  findAll(filters: EventFilters, pagination: Pagination): Promise<PaginatedResult<UsageEvent>>;
  countByGroup(groupBy: string, filters?: DateFilters): Promise<Record<string, number>>;
}

// apps/api/src/routes/events.ts — POST /v1/events/batch
// Request:  UsageEvent[] (zod validated)
// Response: 201 { accepted: number }
//           400 { status: 'error', message: string, details?: ZodIssue[] }

// apps/api/src/routes/events.ts — GET /v1/events
// Query:    ?limit=10&cursor=<id>&agentName=<name>&sessionId=<id>&status=<success|error|cancelled>&from=<ISO>&to=<ISO>
// Response: 200 { data: UsageEvent[], nextCursor: string | null }

// apps/api/src/routes/stats.ts — GET /v1/stats/overview
// Query:    ?from=<ISO>&to=<ISO>
// Response: 200 { total: number, byAgent: Record<string, number>, byStatus: Record<string, number>, byDate: Record<string, number> }
```

## Testing Strategy

| Layer | What | Approach | Location |
|-------|------|----------|----------|
| Unit | Zod validation, error middleware, config parsing | Direct calls, mock DB | `apps/api/src/__tests__/` |
| Integration | Insert/query/stats against real PostgreSQL | Docker PG via `docker compose`, `beforeAll`/`afterAll` setup | `packages/database/src/__tests__/repository.test.ts` |
| Contract | zod → insert → read → zod round-trip | Maximal + minimal event through full pipeline | `packages/database/src/__tests__/repository.test.ts` |
| Route | POST batch, GET events, GET stats | Supertest with mock repository | `apps/api/src/__tests__/events.test.ts` |

## Threat Matrix

N/A — no routing, shell, subprocess, VCS/PR automation, executable-file classification, or process-integration boundary.

## Migration / Rollout

- **drizzle-kit migrate** produces `0000_initial.sql` (up) and `0000_initial.sql` (down) in `packages/database/migrations/`.
- Up migration: `CREATE TABLE IF NOT EXISTS usage_events ...` with all columns and indexes.
- Down migration: `DROP TABLE IF EXISTS usage_events`.
- No data migration needed — greenfield table.
- Docker Compose provides PostgreSQL for dev/test. No production migration until deploy.

## Open Questions

- [ ] API key auth: stub now (middleware present but always passes), implement fully later?
- [ ] `packages/shared/src/errors.ts`: should ApiError carry HTTP status code or just message + details?
