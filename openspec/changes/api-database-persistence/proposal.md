# Proposal: api-database-persistence

## Intent

Build an Express API server with PostgreSQL (via Drizzle ORM) that receives batch UsageEvents from the collector, persists them, and exposes query endpoints for analytics. This completes the C3 persistence layer between the collector (C2) and the future dashboard (C4).

## Scope

### In Scope
- Express server setup (middleware: error handling, zod validation, CORS, API key auth)
- Drizzle schema for `usage_events` table (JSONB for nested groups, indexed top-level columns)
- drizzle-kit migration tooling
- Repository layer (engine-agnostic interface + Drizzle implementation)
- `POST /v1/events/batch` ingestion endpoint with zod validation at boundary
- `GET /v1/events` query endpoint with cursor-based pagination and filters (date range, user, agent, status)
- `GET /v1/stats/overview` aggregation endpoint
- Docker Compose for dev PostgreSQL
- Integration tests with real DB
- TypeScript configs for apps/api and packages/database

### Out of Scope
- Dashboard (C4)
- Authentication/Authorization (future)
- Rate limiting (future)
- WebSocket/SSE (future)
- Production deployment, CI/CD, other collectors

## Capabilities

### New Capabilities
- `api-event-ingestion`: POST batch ingestion with zod validation, idempotent upsert, API key auth
- `api-event-querying`: GET events with filters/pagination + stats overview aggregation

### Modified Capabilities
None

## Approach

**Stack**: Express + zod validation + Drizzle ORM + postgres.js + drizzle-kit. **Schema**: `usage_events` with indexed top-level columns (id, timestamp, user, status) and JSONB for nested groups (actor, agent, metrics, etc.). **Idempotency**: INSERT ON CONFLICT DO NOTHING on UUIDv7 id. **3 slices** (stacked PRs, ~1,080 lines total):

1. **DB schema + repository** (~380 lines): Drizzle schema, repository interface/impl, Docker Compose, integration tests
2. **Express server + ingestion** (~410 lines): server setup, config, middleware (error/validate/auth), POST + GET routes, tests
3. **Stats endpoint + polish** (~290 lines): overview aggregation, CORS, rate limiting, README

## Affected Areas

- `packages/database/` — New: schema.ts, repository.ts, migrations/, drizzle.config.ts, tests
- `apps/api/` — New: server.ts, config.ts, routes/{events,stats}.ts, middleware/*, index.ts, tests
- `packages/shared/` — May need shared error types for API boundary
- Root `package.json` — New workspace deps (express, drizzle-orm, postgres.js, cors, drizzle-kit)
- `docker/` — New: docker-compose.yml for PostgreSQL

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Drizzle schema drift vs zod contract | Med | Derive DB columns from zod types; add contract test (zod parse → DB insert → DB read → zod parse) |
| JSONB query performance for nested fields | Low | Index top-level columns for common queries; JSONB only for nested groups rarely used in WHERE clauses |
| UUIDv7 generation strategy | Low | Generate in API layer via UuidV7Schema (already in event-schema), not in DB |
| Engine-agnostic requirement (config.yaml) | Low | Drizzle query builder is engine-agnostic — swap pg for mysql with config change only |

## Rollback Plan

Each slice is independently revertable via `git revert`:

- **Slice 3** revert: Remove stats route, CORS, rate limiting — DB and ingestion unaffected
- **Slice 2** revert: Remove Express server and routes — DB schema and repository remain functional
- **Slice 1** revert: Remove DB package additions, Docker Compose — no other packages depend on it yet

No migration rollback needed: schema is additive (new table), no existing data to preserve.

## Dependencies

- `@agent-analytics/event-schema` (complete, C1)
- `@agent-analytics/shared` (scaffold)
- Docker running locally for PostgreSQL dev/test

## Success Criteria

- [ ] Collector's batch POST succeeds against running API with real PostgreSQL
- [ ] Events queryable via GET /v1/events with filters and pagination
- [ ] Stats overview returns correct aggregates
- [ ] Integration tests pass against real PostgreSQL
- [ ] All three PRs mergeable within 400-line review budget each
- [ ] Idempotent ingestion: duplicate batch POSTs do not create duplicate rows
