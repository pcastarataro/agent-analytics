# Agent Detail — Full Spec (New Capability)

## Purpose

Provides a per-agent detail endpoint with per-version aggregation, mirroring the existing SkillDetail pattern. Aggregates events grouped by `(agentName, version)` for a single agent.

## Requirements

### Requirement: Agent Detail Endpoint

The system SHALL expose `GET /v1/stats/agents/:name` returning aggregated stats for a single agent. The response MUST include: `agentName`, `executionCount`, `successRate`, `avgDurationMs`, `totalCost`, `avgCost`, `distinctVersions`, `byVersion` (array of `{ version, executionCount, successRate, totalCost }`). The endpoint MUST also include `recentEvents` — the 20 most recent events for that agent. The endpoint MUST return 404 if no events exist for the given `agentName`.

#### Scenario: Agent detail returns stats and per-version breakdown

- GIVEN 50 events for agent "alpha" across 2 versions
- WHEN `GET /v1/stats/agents/alpha` is called
- THEN the response has `agentName = "alpha"`, `executionCount = 50`, `distinctVersions = 2`
- AND `byVersion` has 2 entries with per-version breakdowns
- AND `recentEvents` contains up to 20 events

#### Scenario: Unknown agent returns 404

- GIVEN no events for agentName "nonexistent"
- WHEN `GET /v1/stats/agents/nonexistent` is called
- THEN the response is `404` with `{ "error": "Agent not found" }`

#### Scenario: Single-version agent

- GIVEN 30 events for agent "beta" all at version "1.0.0"
- WHEN `GET /v1/stats/agents/beta` is called
- THEN `distinctVersions = 1` and `byVersion` has exactly 1 entry

#### Scenario: Agent detail includes avgCost

- GIVEN agent "alpha" with costs 0.01, 0.02, 0.03
- WHEN `GET /v1/stats/agents/alpha` is called
- THEN `avgCost = 0.02`
