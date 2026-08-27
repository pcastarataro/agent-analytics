# Delta for API Server

## ADDED Requirements

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

### Requirement: Schema Migration

A Drizzle migration SHALL add the `event_type` column and composite index. The migration MUST be idempotent-safe. Down migration MUST drop the column and index.

#### Scenario: Up migration adds column and index

- GIVEN a database with the existing `usage_events` table
- WHEN the up migration runs
- THEN `event_type` column exists and `idx_session_id_timestamp` index exists

#### Scenario: Down migration removes column and index

- GIVEN a database with the `event_type` column
- WHEN the down migration runs
- THEN the column and index are removed

### Requirement: Test Coverage

Integration tests MUST cover: (1) session list returns correct aggregations, (2) session detail returns ordered events, (3) composite index is used, (4) 404 for missing session.

#### Scenario: Integration tests pass

- GIVEN the API integration test suite
- WHEN `jest` runs against `apps/api`
- THEN all session endpoint tests pass
