# API Server Specification

## Purpose

Defines the Express API server and PostgreSQL persistence layer for UsageEvents: server bootstrap, Drizzle ORM schema, migrations, batch ingestion, event querying, stats aggregation, and schema-to-zod contract integrity.

## Requirements

### Requirement: API Server Setup

The system SHALL provide an Express server written in TypeScript that starts on a configurable PORT. The server MUST apply request validation via zod at the boundary (incoming payloads parsed through zod schemas before reaching route handlers). The server MUST include error-handling middleware that catches unhandled errors and returns a consistent JSON error response with `status`, `message`, and optional `details`. The server MUST configure CORS with configurable origins. All middleware SHALL be applied in order: CORS → validation → routes → error handler.

#### Scenario: Server starts and responds to health check

- GIVEN the server is configured with a valid PORT and database URL
- WHEN the server starts
- THEN it binds to the port and responds `200` to `GET /health`

#### Scenario: Invalid request body rejected at boundary

- GIVEN a route expects a zod-validated body
- WHEN a request arrives with an invalid body (e.g. missing required field)
- THEN the server responds with `400` and a structured error containing the zod validation issues

#### Scenario: Unhandled error caught by middleware

- GIVEN a route handler throws an unexpected error
- WHEN the error propagates
- THEN the error middleware responds with `500` and a generic message, and the error is logged

#### Scenario: CORS blocks disallowed origin

- GIVEN CORS is configured with `origin: ["https://app.example.com"]`
- WHEN a request arrives from `https://evil.com`
- THEN the response is blocked per CORS policy

### Requirement: Database Schema

The system SHALL define a `usage_events` table via Drizzle ORM schema in `packages/database`. The table MUST use a UUIDv7 string as primary key (`id`). JSONB columns MUST store nested groups: `execution` (traceId, parentId), `tokens` (inputTokens, outputTokens, cachedTokens), `cost` (totalCost, currency), `skills` (agentName, skillName, version, definitionHash). Top-level indexed columns MUST include: `agentName` (text), `sessionId` (text), `timestamp` (timestamptz), `status` (text enum: success, error, cancelled). The schema MUST remain engine-agnostic at the repository interface level — Drizzle query builder usage is permitted, but raw SQL dialect fragments SHALL NOT appear.

#### Scenario: Full event round-trip

- GIVEN a valid UsageEvent with all fields populated
- WHEN inserted into `usage_events` via the repository
- THEN every field is persisted and retrievable without data loss

#### Scenario: Partial event inserted

- GIVEN a UsageEvent with only mandatory fields
- WHEN inserted
- THEN nullable fields are stored as NULL/JSON null and retrievable as such

#### Scenario: Index support for common filters

- GIVEN rows exist with varying `agentName`, `sessionId`, and `timestamp`
- WHEN querying with a WHERE clause on any of those columns
- THEN the query uses the declared index (EXPLAIN shows index scan)

#### Scenario: Engine-agnostic interface

- GIVEN a repository interface is defined
- WHEN implemented with Drizzle's query builder (no raw SQL)
- THEN the interface can be swapped for a different Drizzle-compatible engine without interface changes

### Requirement: Database Migration

The system SHALL use drizzle-kit for schema migrations. The migration tooling MUST produce up/down SQL files stored in `packages/database/migrations/`. Up migrations SHALL be idempotent-safe for the initial table creation. Down migrations SHALL cleanly drop the table and its indexes. The drizzle.config.ts MUST reference the schema file and output directory.

#### Scenario: Up migration creates table

- GIVEN a clean database with no `usage_events` table
- WHEN the up migration runs
- THEN the `usage_events` table exists with all columns and indexes

#### Scenario: Down migration drops table

- GIVEN a database with the `usage_events` table
- WHEN the down migration runs
- THEN the table and all associated indexes are removed

#### Scenario: Migration idempotency

- GIVEN the up migration has already run once
- WHEN the up migration runs again
- THEN it completes without error (table already exists)

### Requirement: Batch Ingestion

The system SHALL expose `POST /v1/events/batch` accepting a JSON array of UsageEvent objects. Each event MUST be validated individually against `usageEventSchema` from `@agent-analytics/event-schema`. Valid events SHALL be inserted via `INSERT ... ON CONFLICT (id) DO NOTHING` making ingestion idempotent — duplicate batch POSTs MUST NOT create duplicate rows. The endpoint MUST return the count of accepted (inserted or already-existing) events. The endpoint MUST be non-blocking on validation errors: invalid events are logged and skipped, the rest of the batch is processed. The whole batch MUST NOT be rejected because of a single invalid event.

#### Scenario: Valid batch accepted

- GIVEN a batch of 10 valid UsageEvents
- WHEN `POST /v1/events/batch` is called
- THEN the response is `201` with `{ "accepted": 10 }` and all 10 rows exist in the database

#### Scenario: Duplicate batch is idempotent

- GIVEN 5 events already persisted
- WHEN the same `POST /v1/events/batch` is called again
- THEN the response is `201` with `{ "accepted": 5 }` and no new rows are created

#### Scenario: Mixed valid/invalid batch

- GIVEN a batch of 8 valid events and 2 invalid events (e.g. missing required field)
- WHEN `POST /v1/events/batch` is called
- THEN the response is `201` with `{ "accepted": 8 }`, invalid events are logged, and 8 rows are inserted

#### Scenario: Empty batch

- GIVEN a request with an empty array `[]`
- WHEN `POST /v1/events/batch` is called
- THEN the response is `201` with `{ "accepted": 0 }`

#### Scenario: Non-array body rejected

- GIVEN a request body that is a single object instead of an array
- WHEN `POST /v1/events/batch` is called
- THEN the response is `400` with a validation error

### Requirement: Event Query

The system SHALL expose `GET /v1/events` returning a paginated list of UsageEvents. The endpoint MUST support filtering by `agentName`, `sessionId`, `status`, and date range (`from`, `to` on `timestamp`). Pagination MUST be cursor-based using `limit` and `cursor` (the `id` of the last item from the previous page). The response MUST return `{ data: UsageEvent[], nextCursor: string | null }`. If no more pages exist, `nextCursor` SHALL be `null`.

#### Scenario: Query with no filters returns all events

- GIVEN 15 events exist in the database
- WHEN `GET /v1/events?limit=10` is called
- THEN 10 events are returned and `nextCursor` is non-null

#### Scenario: Cursor pagination works across pages

- GIVEN the first page returned `nextCursor` of `"abc"`
- WHEN `GET /v1/events?limit=10&cursor=abc` is called
- THEN the next 10 events are returned, starting after `"abc"`

#### Scenario: Filter by agent and status

- GIVEN events from agents `A` and `B` with statuses `success` and `error`
- WHEN `GET /v1/events?agentName=A&status=success` is called
- THEN only events matching both filters are returned

#### Scenario: Date range filter

- GIVEN events spanning January through March
- WHEN `GET /v1/events?from=2026-02-01&to=2026-02-28` is called
- ONLY February events are returned

### Requirement: Stats Overview

The system SHALL expose `GET /v1/stats/overview` returning aggregate counts. The response MUST include: total event count, count grouped by `agentName`, count grouped by `status`, and count grouped by date (day granularity). The endpoint MAY accept the same date-range filters as `GET /v1/events` to scope the aggregation.

#### Scenario: Full overview

- GIVEN 100 events across 3 agents and 3 statuses over 5 days
- WHEN `GET /v1/stats/overview` is called
- THEN the response includes `total: 100`, per-agent counts summing to 100, per-status counts summing to 100, and per-date counts summing to 100

#### Scenario: Scoped to date range

- GIVEN events across January and February
- WHEN `GET /v1/stats/overview?from=2026-02-01&to=2026-02-28` is called
- THEN counts include only February events

#### Scenario: Empty result

- GIVEN no events match the filters
- WHEN `GET /v1/stats/overview` is called
- THEN the response is `{ total: 0, byAgent: {}, byStatus: {}, byDate: {} }`

### Requirement: Schema-to-Zod Contract Test

The system MUST include a contract test that proves the Drizzle schema accepts every field from the zod `usageEventSchema` without data loss. The test SHALL: (1) parse a maximal UsageEvent through zod, (2) insert it via the repository, (3) read it back, (4) parse the read result through zod again, (5) assert deep equality. This test MUST be part of the repository integration test suite.

#### Scenario: Round-trip fidelity

- GIVEN a maximal UsageEvent with all fields populated (nested JSONB groups, nullable fields)
- WHEN inserted via repository and read back
- THEN the zod-parsed output equals the original input

#### Scenario: Round-trip with minimal fields

- GIVEN a UsageEvent with only mandatory fields
- WHEN inserted and read back
- THEN the zod-parsed output equals the original input
