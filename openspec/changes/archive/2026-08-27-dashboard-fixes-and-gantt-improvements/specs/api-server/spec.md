# Delta for API Server

## MODIFIED Requirements

### Requirement: User Stats Aggregation Endpoint

The system SHALL expose `GET /v1/stats/users` returning per-user aggregated metrics. The response MUST include an array of objects, each with: `userId`, `eventCount`, `distinctAgents` (count of unique agent names), `distinctSkills` (count of unique skill names), `totalInputTokens` (SUM of `tokens.inputTokens`), `totalOutputTokens` (SUM of `tokens.outputTokens`), `totalCachedTokens` (SUM of `tokens.cachedTokens`), `totalCost` (SUM of `cost.totalCost`), `firstSeenAt`, and `lastSeenAt`. Aggregation MUST group by `actor.userId`. Events without a userId SHALL group under `"unknown"`.

(Previously: No token or cost SUM aggregations — only event counts, distinct agents/skills, and timestamps.)

#### Scenario: User stats with activity

- GIVEN 50 events from user "u1" and 10 from user "u2"
- WHEN `GET /v1/stats/users` is called
- THEN two entries are returned with correct event counts, distinct agent/skill counts, and token/cost totals

#### Scenario: Token SUM aggregation

- GIVEN user "u1" with 3 events: inputTokens 100, 200, 300
- WHEN `GET /v1/stats/users` is called
- THEN user "u1" has `totalInputTokens = 600`

#### Scenario: Cost SUM aggregation

- GIVEN user "u1" with 2 events: cost 0.05 and 0.03
- WHEN `GET /v1/stats/users` is called
- THEN user "u1" has `totalCost = 0.08`

#### Scenario: User stats empty

- GIVEN no events
- WHEN `GET /v1/stats/users` is called
- THEN the response is `{ data: [] }`

#### Scenario: Missing userId groups under unknown

- GIVEN events where `actor.userId` was not set
- WHEN `GET /v1/stats/users` is called
- THEN those events aggregate under userId `"unknown"`

### Requirement: Batch Ingestion

The system SHALL expose `POST /v1/events/batch` accepting a JSON array of UsageEvent objects. Each event MUST be validated individually against `usageEventSchema` from `@agent-analytics/event-schema`. Valid events SHALL be inserted via `INSERT ... ON CONFLICT (content_hash) DO NOTHING` making ingestion idempotent — duplicate batch POSTs MUST NOT create duplicate rows. The endpoint MUST return the count of accepted (inserted or already-existing) events. The endpoint MUST be non-blocking on validation errors: invalid events are logged and skipped, the rest of the batch is processed. The whole batch MUST NOT be rejected because of a single invalid event. The contentHash used for dedup MUST include `event.id` to prevent distinct events with identical payloads from being collapsed.

(Previously: `ON CONFLICT (id) DO NOTHING` — collector retries with new UUID but same payload created phantom duplicates.)

#### Scenario: Valid batch accepted

- GIVEN a batch of 10 valid UsageEvents
- WHEN `POST /v1/events/batch` is called
- THEN the response is `201` with `{ "accepted": 10 }` and all 10 rows exist in the database

#### Scenario: Duplicate batch is idempotent

- GIVEN 5 events already persisted
- WHEN the same `POST /v1/events/batch` is called again
- THEN the response is `201` with `{ "accepted": 5 }` and no new rows are created

#### Scenario: Collector retry with new UUID deduped by contentHash

- GIVEN an event with id="a-1" and contentHash="h1" already persisted
- WHEN a collector retry sends id="a-2" (new UUID) with identical payload producing contentHash="h1"
- THEN the retry is not inserted (ON CONFLICT on contentHash)

#### Scenario: Distinct events with same payload not deduped

- GIVEN two events with different `id` values but different `contentHash` values (IDs are part of hash input)
- WHEN `POST /v1/events/batch` is called with both
- THEN both events are inserted as separate rows

#### Scenario: Mixed valid/invalid batch

- GIVEN a batch of 8 valid events and 2 invalid events
- WHEN `POST /v1/events/batch` is called
- THEN the response is `201` with `{ "accepted": 8 }`, invalid events are logged, and 8 rows are inserted

#### Scenario: Empty batch

- GIVEN a request with an empty array `[]`
- WHEN `POST /v1/events/batch` is called
- THEN the response is `201` with `{ "accepted": 0 }`

### Requirement: Database Schema

The system SHALL define a `usage_events` table via Drizzle ORM schema in `packages/database`. The table MUST use a UUIDv7 string as primary key (`id`). A unique index MUST exist on `content_hash`. JSONB columns MUST store nested groups: `execution` (traceId, parentId), `tokens` (inputTokens, outputTokens, cachedTokens), `cost` (totalCost, currency), `skills` (agentName, skillName, version, definitionHash). Top-level indexed columns MUST include: `agentName` (text), `sessionId` (text), `timestamp` (timestamptz), `status` (text enum: success, error, cancelled). The schema MUST remain engine-agnostic at the repository interface level — Drizzle query builder usage is permitted, but raw SQL dialect fragments SHALL NOT appear.

(Previously: No unique index on `content_hash` — only primary key `id` enforced uniqueness.)

#### Scenario: Unique index prevents duplicate contentHash

- GIVEN an event with contentHash="h1" already in the table
- WHEN an insert with the same contentHash="h1" (different id) is attempted
- THEN the insert violates the unique constraint and is rejected or handled by ON CONFLICT

#### Scenario: Full event round-trip

- GIVEN a valid UsageEvent with all fields populated
- WHEN inserted into `usage_events` via the repository
- THEN every field is persisted and retrievable without data loss

#### Scenario: Partial event inserted

- GIVEN a UsageEvent with only mandatory fields
- WHEN inserted
- THEN nullable fields are stored as NULL/JSON null and retrievable as such

### Requirement: Schema Migration for Content Hash Index

A Drizzle migration SHALL add a unique index on `content_hash`. The migration MUST be idempotent-safe. Down migration MUST drop the index. This is additive — no existing columns or data are modified.

(Previously: No content_hash index existed.)

#### Scenario: Up migration creates unique index

- GIVEN a database with the existing `usage_events` table (no content_hash index)
- WHEN the up migration runs
- THEN a unique index exists on `content_hash`

#### Scenario: Down migration drops index

- GIVEN a database with the content_hash unique index
- WHEN the down migration runs
- THEN the index is removed

#### Scenario: Migration idempotency

- GIVEN the up migration has already run once
- WHEN the up migration runs again
- THEN it completes without error
