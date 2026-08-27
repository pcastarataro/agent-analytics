# Delta for API Server

## ADDED Requirements

### Requirement: Filter "unknown" from Skill Stats

The system SHALL exclude rows where `skillName = 'unknown'` from the `GET /v1/stats/skills` aggregation query. The `WHERE skillName != 'unknown'` clause MUST be applied before grouping so that rows with unknown skill names do not inflate execution counts or cost totals.

#### Scenario: Unknown skill rows excluded

- GIVEN 10 events with `skillName = 'unknown'` and 5 events with `skillName = 'research'`
- WHEN `GET /v1/stats/skills` is called
- THEN only the 5 'research' events are counted
- AND the response does NOT contain an entry for `skillName = 'unknown'`

#### Scenario: All unknowns returns empty

- GIVEN 20 events all with `skillName = 'unknown'`
- WHEN `GET /v1/stats/skills` is called
- THEN the response is `{ data: [] }`

#### Scenario: Known skills unaffected

- GIVEN events with `skillName = 'research'` and `skillName = 'code-gen'`
- WHEN `GET /v1/stats/skills` is called
- THEN both skills appear with correct aggregated metrics

### Requirement: Average Cost in Agent and Skill Stats

The system SHALL include an `avgCost` field (number) in the response objects of both `GET /v1/stats/agents` and `GET /v1/stats/skills`. The value MUST be computed as `SUM(cost.totalCost) / COUNT(*)` grouped by `(agentName, version)` or `(skillName, version)` respectively. The `avgCost` field MUST be present even when `totalCost` is zero (value: `0`).

#### Scenario: Agent stats include avgCost

- GIVEN 4 events for agent "alpha" v1.0 with costs 0.01, 0.02, 0.03, 0.04
- WHEN `GET /v1/stats/agents` is called
- THEN the entry for ("alpha", "v1.0") has `avgCost = 0.025`

#### Scenario: Skill stats include avgCost

- GIVEN 3 events for skill "research" v0.1 with costs 0.06, 0.09, 0.15
- WHEN `GET /v1/stats/skills` is called
- THEN the entry for ("research", "v0.1") has `avgCost = 0.1`

#### Scenario: Zero-cost entries have avgCost 0

- GIVEN 5 events for agent "beta" all with `totalCost = 0`
- WHEN `GET /v1/stats/agents` is called
- THEN the entry for ("beta", *) has `avgCost = 0`

### Requirement: User Detail Endpoint

The system SHALL expose `GET /v1/users/:userId` returning aggregated stats for a single user. The response MUST include: `userId`, `eventCount`, `distinctAgents`, `distinctSkills`, `totalInputTokens`, `totalOutputTokens`, `totalCachedTokens`, `totalCost`, `firstSeenAt`, `lastSeenAt`. The endpoint MUST also include `recentEvents` — the 20 most recent events for that user (cursor-ordered by `timestamp` DESC), each with `id`, `timestamp`, `agentName`, `skillName`, `status`, `durationMs`, `totalCost`. The endpoint MUST return 404 if no events exist for the given `userId`.

#### Scenario: User detail returns stats and events

- GIVEN 30 events from user "u1" across 3 agents
- WHEN `GET /v1/users/u1` is called
- THEN the response has `userId = "u1"`, `eventCount = 30`, `distinctAgents = 3`
- AND `recentEvents` contains up to 20 events ordered by timestamp DESC

#### Scenario: Unknown user returns 404

- GIVEN no events for userId "nonexistent"
- WHEN `GET /v1/users/nonexistent` is called
- THEN the response is `404` with `{ "error": "User not found" }`

#### Scenario: Token totals match SUM aggregation

- GIVEN user "u1" with 3 events having inputTokens: 100, 200, 300
- WHEN `GET /v1/users/u1` is called
- THEN `totalInputTokens = 600`

### Requirement: Skill Detail Endpoint

The system SHALL expose `GET /v1/skills/:skillName` returning aggregated stats for a single skill. The response MUST include: `skillName`, `executionCount`, `successRate`, `avgDurationMs`, `totalCost`, `avgCost`, `distinctVersions` (count of unique versions), `versions` (array of `{ version, executionCount, successRate, totalCost }`). The endpoint MUST also include `recentEvents` — the 20 most recent events for that skill (cursor-ordered by `timestamp` DESC). The endpoint MUST return 404 if no events exist for the given `skillName`.

#### Scenario: Skill detail returns stats and events

- GIVEN 50 events for skill "research" across 2 versions
- WHEN `GET /v1/skills/research` is called
- THEN the response has `skillName = "research"`, `executionCount = 50`, `distinctVersions = 2`
- AND `versions` has 2 entries with per-version breakdowns
- AND `recentEvents` contains up to 20 events

#### Scenario: Unknown skill returns 404

- GIVEN no events for skillName "nonexistent"
- WHEN `GET /v1/skills/nonexistent` is called
- THEN the response is `404` with `{ "error": "Skill not found" }`

#### Scenario: AvgCost included

- GIVEN skill "research" with costs 0.06, 0.09, 0.15
- WHEN `GET /v1/skills/research` is called
- THEN `avgCost = 0.1`

### Requirement: Definition Upsert Endpoint

The system SHALL expose `PUT /v1/definitions/:hash` accepting a JSON body with required fields: `entityType` (string, one of "agent" or "skill"), `entityName` (string), and `content` (string, Markdown). Optional field: `description` (string). The `hash` path parameter is the content hash (text PK) used as the primary identifier. The system MUST upsert the definition — if a row with the given `hash` exists, it is replaced; otherwise a new row is inserted. The `definitions` table MUST use `hash` (text) as the primary key. The response MUST return the upserted definition with `hash`, `entityType`, `entityName`, `content`, `description`, and `createdAt`.

#### Scenario: Create new definition

- GIVEN a request with `hash = "a1b2c3"`, `entityType = "agent"`, `entityName = "my-agent"`, `content = "## Config\n..."`
- WHEN `PUT /v1/definitions/a1b2c3` is called
- THEN the response is `201` with `hash`, `entityType`, `entityName`, `content`
- AND the `definitions` table has one row

#### Scenario: Update existing definition

- GIVEN a definition with `hash = "a1b2c3"` already exists
- WHEN `PUT /v1/definitions/a1b2c3` is called with new `content`
- THEN the response is `200` with the updated `content`
- AND the `definitions` table still has one row for that hash

#### Scenario: Missing required fields rejected

- GIVEN a request with only `content` (no `entityType` or `entityName`)
- WHEN `PUT /v1/definitions/x1y2z3` is called
- THEN the response is `400` with validation error

### Requirement: Definition List and Detail Endpoints

The system SHALL expose `GET /v1/definitions` returning a list of definitions. Each entry MUST include: `hash`, `entityType`, `entityName`, `description`, `createdAt`. The system SHALL expose `GET /v1/definitions/:hash` returning the full definition including `content` (the Markdown body). The detail endpoint MUST return 404 for non-existent hashes.

#### Scenario: List definitions

- GIVEN 5 definitions in the database
- WHEN `GET /v1/definitions` is called
- THEN 5 entries are returned without the `content` field

#### Scenario: Get definition by hash

- GIVEN a definition with `hash = "a1b2c3"`
- WHEN `GET /v1/definitions/a1b2c3` is called
- THEN the full definition including `content` is returned

#### Scenario: Non-existent definition returns 404

- GIVEN no definition with `hash = "z9y8x7"`
- WHEN `GET /v1/definitions/z9y8x7` is called
- THEN the response is `404`
