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

The system SHALL expose `POST /v1/events/batch` accepting a JSON array of UsageEvent objects. Each event MUST be validated individually against `usageEventSchema` from `@agent-analytics/event-schema`. Valid events SHALL be inserted via `INSERT ... ON CONFLICT (id) DO NOTHING` making ingestion idempotent — duplicate batch POSTs MUST NOT create duplicate rows. The endpoint MUST return the count of accepted (inserted or already-existing) events. The endpoint MUST be non-blocking on validation errors: invalid events are logged and skipped, the rest of the batch is processed. The whole batch MUST NOT be rejected because of a single invalid event. The contentHash used for dedup MUST include `event.id` to prevent distinct events with identical payloads from being collapsed.

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

#### Scenario: Distinct events with same payload not deduped

- GIVEN two events with different `id` values but identical `contentHash` payload
- WHEN `POST /v1/events/batch` is called with both
- THEN both events are inserted as separate rows (no false-positive dedup)

### Requirement: Agent Stats Aggregation Endpoint

The system SHALL expose `GET /v1/stats/agents` returning per-agent aggregated metrics. The response MUST include an array of objects, each with: `agentName`, `version`, `executionCount`, `successRate` (0–100 percentage), `avgDurationMs`, and `totalCost`. The endpoint MAY accept date-range filters (`from`, `to`) matching `GET /v1/events`. Aggregation MUST group by `(agentName, version)`.

#### Scenario: Agent stats with multiple versions

- GIVEN 30 events for agent "alpha" v1.0 and 20 events for agent "alpha" v2.0
- WHEN `GET /v1/stats/agents` is called
- THEN two entries are returned: one for ("alpha", "v1.0") with count 30, one for ("alpha", "v2.0") with count 20

#### Scenario: Agent stats scoped to date range

- GIVEN events across January and February for agent "beta"
- WHEN `GET /v1/stats/agents?from=2026-02-01&to=2026-02-28` is called
- THEN only February events are included in the aggregation

#### Scenario: Empty agent stats

- GIVEN no events exist
- WHEN `GET /v1/stats/agents` is called
- THEN the response is `{ data: [] }`

#### Scenario: Unknown agent version fallback

- GIVEN events where `agent.version` was not populated
- WHEN `GET /v1/stats/agents` is called
- THEN those events group under version `"unknown"`

### Requirement: Skill Stats Aggregation Endpoint

The system SHALL expose `GET /v1/stats/skills` returning per-skill aggregated metrics. The response MUST include an array of objects, each with: `skillName`, `version`, `executionCount`, `successRate` (0–100 percentage), and `totalCost`. The endpoint MAY accept date-range filters (`from`, `to`). Aggregation MUST group by `(skillName, version)`.

#### Scenario: Skill stats with versions

- GIVEN 15 events for skill "research" v0.1 and 25 for "research" v0.2
- WHEN `GET /v1/stats/skills` is called
- THEN two entries are returned with correct counts per version

#### Scenario: Skill stats empty

- GIVEN no events with skill data
- WHEN `GET /v1/stats/skills` is called
- THEN the response is `{ data: [] }`

#### Scenario: Unknown skill version fallback

- GIVEN events where `skill.version` was not populated
- WHEN `GET /v1/stats/skills` is called
- THEN those events group under version `"unknown"`

### Requirement: User Stats Aggregation Endpoint

The system SHALL expose `GET /v1/stats/users` returning per-user aggregated metrics. The response MUST include an array of objects, each with: `userId`, `eventCount`, `distinctAgents` (count of unique agent names), `distinctSkills` (count of unique skill names), `firstSeenAt`, and `lastSeenAt`. Aggregation MUST group by `actor.userId`. Events without a userId SHALL group under `"unknown"`.

#### Scenario: User stats with activity

- GIVEN 50 events from user "u1" and 10 from user "u2"
- WHEN `GET /v1/stats/users` is called
- THEN two entries are returned with correct event counts and distinct agent/skill counts

#### Scenario: User stats empty

- GIVEN no events
- WHEN `GET /v1/stats/users` is called
- THEN the response is `{ data: [] }`

#### Scenario: Missing userId groups under unknown

- GIVEN events where `actor.userId` was not set
- WHEN `GET /v1/stats/users` is called
- THEN those events aggregate under userId `"unknown"`

### Requirement: ContentHash Includes Event ID

The contentHash used for deduplication MUST incorporate `event.id` alongside the payload hash. This ensures two distinct events with identical payloads but different IDs are treated as distinct records.

#### Scenario: Different IDs with same payload produce different hashes

- GIVEN event A with id="a-1" and event B with id="b-1" with identical payloads
- WHEN contentHash is computed for each
- THEN the hashes differ

#### Scenario: Same ID with same payload produces same hash

- GIVEN two references to event with id="a-1" and identical payload
- WHEN contentHash is computed
- THEN the hashes are identical

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

### Requirement: Database Column `event_type`

The `usage_events` table SHALL include a nullable `event_type` text column. The column MUST store the `execution.eventType` value at write time for fast filtering without JSONB extraction.

#### Scenario: New column accepts event type

- GIVEN an event with `execution.eventType = "tool_call"`
- WHEN inserted into `usage_events`
- THEN the `event_type` column contains `"tool_call"`

#### Scenario: Pre-migration events have null

- GIVEN an event emitted before migration (no `eventType`)
- WHEN inserted into `usage_events`
- THEN the `event_type` column is `NULL`

### Requirement: Composite Index for Session Queries

A composite index `idx_session_id_timestamp` SHALL exist on `(session_id, timestamp)` to optimize session-scoped queries ordered by time.

#### Scenario: Session event query uses composite index

- GIVEN 1000 events across multiple sessions
- WHEN querying events for a single `session_id` ordered by `timestamp`
- THEN the query plan uses `idx_session_id_timestamp`

### Requirement: Session List Endpoint

The system SHALL expose `GET /v1/sessions` returning a paginated list of sessions. Each session MUST include: `traceId`, `agentName`, `eventCount`, `firstEventAt`, `lastEventAt`, `durationMs` (lastEventAt - firstEventAt). Pagination SHALL use cursor-based `limit`/`cursor` (cursor = last `traceId`).

#### Scenario: List sessions returns aggregations

- GIVEN 5 distinct sessions with varying event counts
- WHEN `GET /v1/sessions?limit=10` is called
- THEN 5 sessions are returned with correct `eventCount`, `firstEventAt`, `lastEventAt`, `durationMs`

#### Scenario: Cursor pagination for sessions

- GIVEN 25 sessions exist
- WHEN `GET /v1/sessions?limit=10` is called
- THEN 10 sessions are returned and `nextCursor` is non-null

#### Scenario: Empty session list

- GIVEN no events in the database
- WHEN `GET /v1/sessions` is called
- THEN the response is `{ data: [], nextCursor: null }`

### Requirement: Session Detail Endpoint

The system SHALL expose `GET /v1/sessions/:traceId` returning all events for a session ordered by `timestamp` ascending. Each event MUST include: `id`, `eventType` (or `"unknown"` if null), `agentName`, `timestamp`, `durationMs`, `status`, and the full `execution` JSONB for parent-child relationships.

#### Scenario: Session detail returns ordered events

- GIVEN a session with 20 events spanning 5 minutes
- WHEN `GET /v1/sessions/{traceId}` is called
- THEN 20 events are returned in chronological order

#### Scenario: Missing session returns 404

- GIVEN no events for a non-existent `traceId`
- WHEN `GET /v1/sessions/{traceId}` is called
- THEN the response is `404` with `{ "error": "Session not found" }`

#### Scenario: Events include eventType

- GIVEN events with and without `eventType`
- WHEN session detail is returned
- THEN events with `eventType` show the value; events without show `"unknown"`

### Requirement: Schema Migration for Event Type

A Drizzle migration SHALL add the `event_type` column and composite index. The migration MUST be idempotent-safe. Down migration MUST drop the column and index.

#### Scenario: Up migration adds column and index

- GIVEN a database with the existing `usage_events` table
- WHEN the up migration runs
- THEN `event_type` column exists and `idx_session_id_timestamp` index exists

#### Scenario: Down migration removes column and index

- GIVEN a database with the `event_type` column
- WHEN the down migration runs
- THEN the column and index are removed

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
