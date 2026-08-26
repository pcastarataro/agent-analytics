# Exploration: api-database-persistence (C3)

Date: 2026-08-26 · Phase: sdd-explore · Store: openspec · Review budget: 400 lines/slice
Sources: archived C1/C2 specs + code, repo state @ main, collector HTTP client analysis.
Inherits from archived C2 exploration: collector POST contract, batch endpoint shape, config resolution, validation-before-enqueue pattern.

## Current State

C1 (event-schema) and C2 (collector-plugin) are complete and archived. The collector POSTs batches to `POST {url}/v1/events/batch` with body `{ events: UsageEvent[] }` and optional `X-API-Key` header (see `packages/opencode-collector/src/infra/http-client.ts:34-41`).

Repo has npm workspaces + TS strict + Jest/@swc/jest + ESLint flat. Two relevant scaffolds exist but are stubs:

- `packages/database/` — `package.json` (deps: `@agent-analytics/shared` only), empty `src/index.ts` exporting package name + dependency helper
- `apps/api/` — `package.json` (deps: `@agent-analytics/event-schema` + `@agent-analytics/shared`), empty `src/index.ts` exporting package name + dependency helper

No Docker/docker-compose, no `.env`, no database driver, no migration tool, no Express/Fastify installed yet. The `openspec/config.yaml` states: *"Database: engine chosen by installer via DATABASE env var; repository layer abstracts the engine; domain MUST stay engine-agnostic."*

## Affected Areas

- `packages/database/` — will house Drizzle schema, migrations, repository layer (engine-agnostic interface)
- `apps/api/` — will become Express server with routes, middleware, error handling
- `packages/shared/` — may need shared types/errors for API boundary
- Root `package.json` — new workspace deps (express, drizzle-orm, pg, etc.)
- `docker/` — PostgreSQL container for dev (new directory)

## Gap 1 — Framework choice: Express vs Fastify

| Approach | Pros | Cons | Complexity |
|----------|------|------|------------|
| Express | Ubiquitous, minimal learning curve, massive ecosystem, simple middleware model | Older API surface, no built-in validation, slower than Fastify | Low |
| Fastify | Faster, built-in JSON schema validation, TypeScript-first, plugin architecture | Smaller ecosystem, steeper learning curve, may be overkill for this scale | Med |

**Recommendation: Express.** The API is a thin ingestion layer — one POST endpoint, a few GET query endpoints. Fastify's performance优势 are irrelevant at collector-scale throughput (batches of ≤100 events). Express's simplicity wins. Validation at the boundary should use zod (already in the project), not Fastify's JSON schema system.

## Gap 2 — PostgreSQL driver + ORM choice

| Approach | Pros | Cons | Complexity |
|----------|------|------|------------|
| `pg` (node-postgres) | Battle-tested, minimal abstraction, full control | Verbose SQL strings, no type safety at query level, manual migrations | Low |
| `postgres.js` | Modern, fast, built-in TypeScript support, no native deps | Newer, less ecosystem coverage than pg | Low |
| Drizzle ORM | Type-safe queries from schema, built-in migration tooling (drizzle-kit), SQL-like API, engine-agnostic (pg/mysql) | Newer ORM, smaller community than Prisma | Med |
| Prisma | Full ORM, excellent DX, migration tooling, generated client | Heavyweight, engine-specific generator, slower startup, less control over SQL | High |

**Recommendation: Drizzle ORM + postgres.js driver.** Reasons:
1. Drizzle's schema-as-code approach maps naturally to the `usageEventSchema` zod contract — define the DB schema in TypeScript, get type-safe queries.
2. `drizzle-kit` handles migrations natively — no need for separate migration tooling.
3. Drizzle is engine-agnostic (supports pg, mysql), satisfying the `config.yaml` requirement that *"domain MUST stay engine-agnostic."*
4. `postgres.js` is a lighter, faster driver than `pg` with better TypeScript support.
5. Prisma is overkill — we don't need a full ORM with relation management for a flat events table.

## Gap 3 — Schema migration strategy

**Recommendation: drizzle-kit.** It generates SQL migrations from the Drizzle schema definition. Workflow:
1. Define schema in `packages/database/src/schema.ts`
2. Run `npx drizzle-kit generate` to create migration SQL
3. Run `npx drizzle-kit migrate` to apply

This keeps migrations version-controlled, deterministic, and engine-agnostic (drizzle-kit can generate for both pg and mysql).

## Gap 4 — API surface: what endpoints does C4 (dashboard) need?

The collector only POSTs batches. The dashboard needs read endpoints. Based on typical analytics dashboards and the UsageEvent schema:

| Endpoint | Purpose | Query Complexity |
|----------|---------|-----------------|
| `POST /v1/events/batch` | Ingestion (collector) | Simple INSERT |
| `GET /v1/events` | List events with filters (date range, user, agent, status) | Medium (indexed queries) |
| `GET /v1/events/:id` | Single event detail | Simple SELECT |
| `GET /v1/stats/overview` | Aggregate stats (total events, cost, tokens, success rate) | Medium (GROUP BY) |
| `GET /v1/stats/by-agent` | Per-agent breakdown | Medium (GROUP BY agent.name) |
| `GET /v1/stats/by-model` | Per-model breakdown | Medium (GROUP BY model fields) |
| `GET /v1/stats/timeseries` | Events/cost over time (hourly/daily buckets) | Medium (date trunc + GROUP BY) |

**Recommendation: Start with `POST /v1/events/batch` + `GET /v1/events` + `GET /v1/stats/overview` in C3.** The by-agent/by-model/timeseries endpoints are C4 concerns — don't overbuild. The `GET /v1/events` endpoint should support cursor-based pagination (UUIDv7 ids are naturally sortable) and basic filters (date range, user, agent, status).

## Gap 5 — Collector → API contract details

From `http-client.ts:34-41`:
- **Method**: POST
- **Path**: `/v1/events/batch`
- **Headers**: `Content-Type: application/json`, optional `X-API-Key: <key>`
- **Body**: `{ events: UsageEvent[] }`
- **Expected response**: Any 2xx for success; 4xx for client errors (dropped, not retried); 5xx/network for retry

The API must:
1. Validate the batch body with `usageEventSchema` (zod, already available)
2. Accept `X-API-Key` header for authentication (configurable via env)
3. Return 200/201 on success, 400 on validation error, 401 on bad API key
4. Be idempotent on event `id` (UUIDv7, client-generated) — INSERT ON CONFLICT DO NOTHING

## Gap 6 — Error handling, validation, CORS, rate limiting

- **Validation**: zod at the API boundary (validate request body against `usageEventSchema` batch shape). Return structured error responses.
- **Error handling**: Express error middleware — catch all, return `{ error: string, details?: unknown }`. Log server-side.
- **CORS**: Allow from dashboard origin (configurable via env `CORS_ORIGIN`). Use `cors` package.
- **Rate limiting**: Simple in-memory rate limiter (e.g., `express-rate-limit`). Configurable via env. Collector batches are low-frequency, but protect against abuse.
- **API key auth**: Check `X-API-Key` header against configured key. If no key configured, skip auth (dev mode).

## Gap 7 — Testing strategy

| Approach | Pros | Cons | Effort |
|----------|------|------|--------|
| Unit tests (mocked DB) | Fast, no infra needed | Doesn't prove real SQL works | Low |
| Integration tests (real PostgreSQL) | Proves actual persistence, catches SQL errors | Requires running DB, slower | Med |
| Docker Compose test DB | Reproducible, CI-friendly | Adds docker dependency | Med |

**Recommendation: Integration tests with real PostgreSQL via Docker Compose.** The `packages/database` layer should have tests that run against a real DB. Use `docker-compose` with a test PostgreSQL instance. Tests in `apps/api` should test routes with a real DB (spin up in beforeAll, tear down in afterAll). This is the only way to catch Drizzle schema mismatches and SQL errors.

## Gap 8 — Package structure

```
packages/database/
  src/
    schema.ts          # Drizzle table definitions (maps to UsageEvent)
    repository.ts      # Engine-agnostic interface + Drizzle implementation
    migrations/        # drizzle-kit generated SQL
    index.ts           # Public exports
  drizzle.config.ts    # drizzle-kit configuration

apps/api/
  src/
    server.ts          # Express app setup (middleware, routes)
    routes/
      events.ts        # POST /v1/events/batch, GET /v1/events, GET /v1/events/:id
      stats.ts         # GET /v1/stats/overview
    middleware/
      error-handler.ts # Global error handler
      validate.ts      # Zod validation middleware
      auth.ts          # API key check
      cors.ts          # CORS setup
      rate-limit.ts    # Rate limiting
    config.ts          # Server config from env
    index.ts           # Entry point (start server)
```

## Approaches (slice plan)

Dependency order: D1 → D2 → D3; each independently mergeable.

### Slice 1: Database schema + repository + Drizzle setup

- `packages/database/src/schema.ts` — Drizzle table definition for `usage_events` (~60 lines)
- `packages/database/drizzle.config.ts` — drizzle-kit config (~15 lines)
- `packages/database/src/repository.ts` — Repository interface + Drizzle implementation: `insertBatch`, `findById`, `findWithFilters` (~120 lines)
- `packages/database/src/index.ts` — Public exports (~15 lines)
- `packages/database/src/__tests__/repository.test.ts` — Integration tests with real DB (~150 lines)
- `docker-compose.yml` — PostgreSQL container for dev/test (~20 lines)
- Root `package.json` — Add drizzle-orm, postgres.js, drizzle-kit deps
- Estimate: **~380 lines** → 400-line budget risk: Low

### Slice 2: Express server + ingestion endpoint + middleware

- `apps/api/src/server.ts` — Express app with middleware (~40 lines)
- `apps/api/src/config.ts` — Server config from env (~30 lines)
- `apps/api/src/middleware/error-handler.ts` — Global error handler (~25 lines)
- `apps/api/src/middleware/validate.ts` — Zod validation middleware (~30 lines)
- `apps/api/src/middleware/auth.ts` — API key check (~25 lines)
- `apps/api/src/routes/events.ts` — POST /v1/events/batch + GET /v1/events (~100 lines)
- `apps/api/src/index.ts` — Entry point (~20 lines)
- `apps/api/src/__tests__/events.test.ts` — Route integration tests (~120 lines)
- Root `package.json` — Add express, cors, @types deps
- Estimate: **~410 lines** → 400-line budget risk: Medium (split auth middleware if needed)

### Slice 3: Stats endpoint + docs + polish

- `apps/api/src/routes/stats.ts` — GET /v1/stats/overview (~60 lines)
- `packages/database/src/repository.ts` — Add `getOverviewStats` method (~40 lines)
- `apps/api/src/__tests__/stats.test.ts` — Stats endpoint tests (~80 lines)
- README for apps/api — Setup, config, running (~60 lines)
- Rate limiting middleware (~30 lines)
- CORS configuration (~20 lines)
- Estimate: **~290 lines** → 400-line budget risk: Low

Forecast totals ≈ 1,080 changed lines across 3 slices. Overall budget risk: **Low**.

## Recommendation

Proceed to proposal with:
- **Express** (simple, sufficient for scale) + **zod** validation at boundary
- **Drizzle ORM** + **postgres.js** (type-safe, engine-agnostic, built-in migrations)
- **drizzle-kit** for schema migrations
- Start with 3 endpoints: `POST /v1/events/batch`, `GET /v1/events`, `GET /v1/stats/overview`
- Integration tests with real PostgreSQL via Docker Comple
- 3-slice chained PRs: DB schema → API server → stats + polish

## Risks

- **Drizzle schema drift**: The DB schema must stay in sync with the zod `usageEventSchema`. Mitigation: derive DB columns from the zod types where possible, add a contract test that validates a round-trip (zod parse → DB insert → DB read → zod parse).
- **UUIDv7 ordering**: PostgreSQL UUIDv7 support requires `pg_uuidv7` extension or app-level generation. Mitigation: generate UUIDv7 in the API layer (already have `UuidV7Schema` from event-schema), not in the DB.
- **Flat vs relational storage**: UsageEvent has nested objects (actor, agent, metrics, etc.). Mitigation: store as JSONB columns for flexible nested data, with indexed top-level columns (id, timestamp, user, status) for efficient queries. This matches the "loose object tolerance" design in the event schema.
- **Engine-agnostic requirement**: `config.yaml` says domain must stay engine-agnostic. Mitigation: Drizzle's query builder is already engine-agnostic — swap `drizzle-orm/postgres-js` for `drizzle-orm/mysql2` with config change only.

## Ready for Proposal

YES — run sdd-propose for change `api-database-persistence` with the scope above; carry the endpoint contract, schema design (JSONB for nested groups), and slice plan into the proposal.
