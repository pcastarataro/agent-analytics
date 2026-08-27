# API Server — Delta Spec

## ADDED Requirements

### Requirement: Agent Detail Endpoint

The system SHALL expose `GET /v1/stats/agents/:name` returning aggregated stats for a single agent. The response MUST include: `agentName`, `executionCount`, `successRate`, `avgDurationMs`, `totalCost`, `avgCost`, `distinctVersions`, `byVersion` (array of `{ version, executionCount, successRate, totalCost }`), and `recentEvents` (20 most recent). Aggregation MUST group by `(agentName, version)`. The endpoint MUST return 404 for unknown agents.

#### Scenario: Agent detail returns stats and version breakdown

- GIVEN 50 events for agent "alpha" across 2 versions
- WHEN `GET /v1/stats/agents/alpha` is called
- THEN `distinctVersions = 2` and `byVersion` has 2 entries

#### Scenario: Unknown agent returns 404

- GIVEN no events for "nonexistent"
- WHEN `GET /v1/stats/agents/nonexistent` is called
- THEN the response is `404`

## MODIFIED Requirements

### Requirement: Definition Upsert Endpoint

The system SHALL expose `PUT /v1/definitions/:hash` accepting a JSON body with required fields: `entityType` (string, one of "agent" or "skill"), `entityName` (string), and `content` (string, Markdown). Optional fields: `description` (string), `version` (string, nullable). The `hash` path parameter is the content hash used as the primary identifier. The system MUST upsert the definition — if a row with the given `hash` exists, it is replaced; otherwise a new row is inserted. The `definitions` table MUST use `hash` (text) as the primary key. The response MUST return the upserted definition including `hash`, `entityType`, `entityName`, `content`, `description`, `version`, and `createdAt`. (Previously: no `version` parameter accepted)

#### Scenario: Create new definition with version

- GIVEN a request with `hash = "a1b2c3"`, `entityType = "agent"`, `entityName = "my-agent"`, `content = "..."`, `version = "1.0.0"`
- WHEN `PUT /v1/definitions/a1b2c3` is called
- THEN the response is `201` with `version = "1.0.0"`
- AND the `definitions` table has one row with `version = '1.0.0'`

#### Scenario: Create definition without version

- GIVEN a request without `version`
- WHEN `PUT /v1/definitions/x1y2z3` is called
- THEN the response is `201` with `version = null`
- AND the `definitions` table row has `version = NULL`

### Requirement: Definition List and Detail Endpoints

The system SHALL expose `GET /v1/definitions` returning a list of definitions. Each entry MUST include: `hash`, `entityType`, `entityName`, `description`, `version`, `createdAt`. The system SHALL expose `GET /v1/definitions/:hash` returning the full definition including `content`. The detail endpoint MUST return 404 for non-existent hashes. (Previously: `version` was not included in the list response)

#### Scenario: List definitions includes version

- GIVEN 3 definitions, one with `version = "1.0.0"`, two with `version = null`
- WHEN `GET /v1/definitions` is called
- THEN each entry includes a `version` field (string or null)

### Requirement: ContentHash Consistency for Detail Pages

The definitionHash used for detail page lookups MUST be computed from the definition content, not from the entity name. The same hashing algorithm MUST be used for both ingestion (event contentHash) and detail page lookups. (Previously: detail pages used entity name as hash, causing mismatches)

#### Scenario: Detail page lookup uses content-based hash

- GIVEN a definition with `entityName = "my-agent"` and `content = "## Config..."`
- WHEN the detail page looks up the definition
- THEN the hash is computed from the content, not the entity name

#### Scenario: Consistent hash between ingestion and lookup

- GIVEN an event ingested with `definitionHash` computed from content
- WHEN the detail page resolves the definition by that hash
- THEN the same hash is returned (no mismatch)

## REMOVED Requirements

(None)
