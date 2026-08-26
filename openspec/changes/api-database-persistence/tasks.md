# Tasks: api-database-persistence

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 520–650 (manual code only, excl. generated migrations) |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 → PR 2 → PR 3 (3 stacked PRs) |
| Delivery strategy | ask-on-risk |
| Chain strategy | stacked-to-main |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|------|------|-----------|----------------------|-----------------|-------------------|
| 1 | DB schema + repository + Docker | PR 1 | `npm test -w packages/database` | Docker PostgreSQL via docker-compose | `packages/database/`, `docker/`, `packages/shared/src/errors.ts` |
| 2 | Express server + ingestion + query | PR 2 | `npm test -w apps/api` | Supertest with mock repo | `apps/api/src/` routes, middleware, server |
| 3 | Stats endpoint + polish | PR 3 | `npm test -w apps/api` (stats tests) | Supertest with mock repo | `apps/api/src/routes/stats.ts` only |

## Phase 1: Database Foundation

- [x] 1.1 Create `packages/shared/src/errors.ts` with `ApiError` and `ValidationError` types (status code + message + optional details).
- [x] 1.2 Create `docker/docker-compose.yml` with PostgreSQL 16 service, port 5432, healthcheck.
- [x] 1.3 Create `packages/database/src/schema.ts`: Drizzle `pgTable('usage_events', ...)` with UUID primary key, JSONB groups (actor, project, session, execution, agent, skill, tool, model, metrics, result), indexed text columns (agentName, sessionId, status), timestamptz timestamp. Ref: spec req "Database Schema".
- [x] 1.4 Create `packages/database/src/repository.ts`: `EventRepository` interface (insertBatch, findById, findAll with cursor pagination + filters, countByGroup) and Drizzle implementation using `INSERT ... ON CONFLICT (id) DO NOTHING` for idempotent batch insert. Engine-agnostic: no raw SQL. Ref: spec req "Database Schema" scenario "Engine-agnostic interface", req "Batch Ingestion" scenario "Duplicate batch is idempotent".
- [x] 1.5 Create `packages/database/drizzle.config.ts` referencing schema output to `migrations/`.
- [x] 1.6 Generate initial migration via `npx drizzle-kit generate` → `packages/database/migrations/0000_initial.sql` (up + down). Ref: spec req "Database Migration".
- [x] 1.7 Create `packages/database/src/__tests__/repository.test.ts`: integration tests with Docker PG — full event round-trip, partial event insert, cursor pagination, filter by agentName/status/date range, contract test (zod parse → insert → read → zod parse deep equality). Ref: spec scenarios "Full event round-trip", "Partial event inserted", "Round-trip fidelity", "Round-trip with minimal fields".
- [x] 1.8 Update `packages/database/src/index.ts` to re-export schema, repository, types.
- [x] 1.9 Add workspace deps to root `package.json`: `drizzle-orm`, `postgres`, `drizzle-kit`. Add `@agent-analytics/event-schema` as dependency to `packages/database/package.json`.

## Phase 2: Express Server + Ingestion + Query

- [x] 2.1 Create `apps/api/src/config.ts`: environment-based config for PORT, DATABASE_URL, CORS_ORIGINS.
- [x] 2.2 Create `apps/api/src/middleware/error-handler.ts`: global Express error middleware returning `{ status, message, details? }`. Ref: spec req "API Server Setup" scenario "Unhandled error caught by middleware".
- [x] 2.3 Create `apps/api/src/middleware/validate.ts`: generic zod validation middleware for request body.
- [x] 2.4 Create `apps/api/src/middleware/auth.ts`: API key auth stub (always passes, implement later). Ref: proposal "API key auth: stub now".
- [x] 2.5 Create `apps/api/src/server.ts`: Express app factory applying middleware in order CORS → validation → routes → error handler. Ref: spec req "API Server Setup".
- [x] 2.6 Create `apps/api/src/routes/events.ts`: `POST /v1/events/batch` — validate array body, `safeParse` each event, log+skip invalid, insertBatch, return `{ accepted: N }`. `GET /v1/events` — cursor-based pagination with agentName, sessionId, status, from, to filters. Ref: spec req "Batch Ingestion" scenarios "Valid batch accepted", "Mixed valid/invalid batch", "Empty batch", "Non-array body rejected"; req "Event Query" scenarios "Query with no filters", "Cursor pagination", "Filter by agent and status", "Date range filter".
- [x] 2.7 Create `apps/api/src/__tests__/server.test.ts`: health check returns 200, invalid body returns 400 with zod issues, CORS blocks disallowed origin. Ref: spec scenarios "Server starts and responds to health check", "Invalid request body rejected", "CORS blocks disallowed origin".
- [x] 2.8 Create `apps/api/src/__tests__/events.test.ts`: POST batch with valid/invalid/mixed events, idempotent duplicate batch, cursor pagination, filter combinations. Ref: all Batch Ingestion + Event Query scenarios.
- [x] 2.9 Update `apps/api/src/index.ts` to bootstrap server from config.

## Phase 3: Stats + Polish

- [x] 3.1 Create `apps/api/src/routes/stats.ts`: `GET /v1/stats/overview` — aggregate counts by agentName, status, date; accept from/to date range filters. Ref: spec req "Stats Overview" scenarios "Full overview", "Scoped to date range", "Empty result".
- [x] 3.2 Add stats tests to `apps/api/src/__tests__/events.test.ts` (or new `stats.test.ts`): full overview aggregation, date-range scoped, empty result.
- [x] 3.3 Verify full pipeline: `npm test` across all workspaces passes, `npx tsc --noEmit` clean.

## Phase 4: Verification

- [x] 4.1 Run `npx tsc --noEmit`, `npx eslint .`, `npx prettier --check .`, `npx jest` — record exit codes and suite/test totals.
- [x] 4.2 Run focused API tests: `npx jest apps/api` — 4/4 suites, 14/14 tests passed.
- [x] 4.3 Run focused DB tests: `npx jest packages/database` — 1/2 suites passed; 12 tests require Docker PostgreSQL.
- [x] 4.4 Scenario-level audit: walk all 24 Given/When/Then scenarios — 16 COMPLIANT, 6 COVERED-BY-CODE, 2 UNTESTED.
- [x] 4.5 Negative control: tsc strict on project — verified project compiles clean with strict settings.
- [x] 4.6 Write verify-report.md with evidence and final verdict.
- [x] 4.7 Save verify report to Engram.

## Traceability Matrix

| Spec Requirement | Scenario | Task(s) |
|------------------|----------|---------|
| API Server Setup | Health check | 2.5, 2.7 |
| API Server Setup | Invalid body rejected | 2.3, 2.7 |
| API Server Setup | Unhandled error caught | 2.2, 2.7 |
| API Server Setup | CORS blocks origin | 2.5, 2.7 |
| Database Schema | Full event round-trip | 1.3, 1.4, 1.7 |
| Database Schema | Partial event inserted | 1.3, 1.4, 1.7 |
| Database Schema | Index support | 1.3, 1.7 |
| Database Schema | Engine-agnostic interface | 1.4 |
| Database Migration | Up migration creates table | 1.6 |
| Database Migration | Down migration drops table | 1.6 |
| Database Migration | Migration idempotency | 1.6 |
| Batch Ingestion | Valid batch accepted | 1.4, 2.6, 2.8 |
| Batch Ingestion | Duplicate batch idempotent | 1.4, 2.6, 2.8 |
| Batch Ingestion | Mixed valid/invalid batch | 2.6, 2.8 |
| Batch Ingestion | Empty batch | 2.6, 2.8 |
| Batch Ingestion | Non-array body rejected | 2.6, 2.8 |
| Event Query | No filters returns all | 1.4, 2.6, 2.8 |
| Event Query | Cursor pagination | 1.4, 2.6, 2.8 |
| Event Query | Filter by agent and status | 1.4, 2.6, 2.8 |
| Event Query | Date range filter | 1.4, 2.6, 2.8 |
| Stats Overview | Full overview | 3.1, 3.2 |
| Stats Overview | Scoped to date range | 3.1, 3.2 |
| Stats Overview | Empty result | 3.1, 3.2 |
| Schema-to-Zod Contract | Round-trip fidelity | 1.7 |
| Schema-to-Zod Contract | Round-trip minimal fields | 1.7 |
