# Delta for API Server

## MODIFIED Requirements

### Requirement: Batch Ingestion

The system SHALL expose `POST /v1/events/batch` accepting a JSON array of UsageEvent objects. Each event MUST be validated individually against `usageEventSchema` from `@agent-analytics/event-schema`. Valid events SHALL be inserted via `INSERT ... ON CONFLICT (id) DO NOTHING` making ingestion idempotent — duplicate batch POSTs MUST NOT create duplicate rows. The endpoint MUST return the count of accepted (inserted or already-existing) events. The endpoint MUST be non-blocking on validation errors: invalid events are logged and skipped, the rest of the batch is processed. The whole batch MUST NOT be rejected because of a single invalid event. The contentHash used for dedup MUST include `event.id` to prevent distinct events with identical payloads from being collapsed.
(Previously: contentHash did not include event.id, causing false-positive dedup of distinct events.)

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

## ADDED Requirements

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
