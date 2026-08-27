# Dashboard UI — Delta Spec

## ADDED Requirements

### Requirement: Agent Detail Page

The dashboard SHALL include a `/agents/:agentName` route rendering a detail page for a single agent. The page SHALL display: agentName, execution count, success rate, avg duration, total cost, avg cost, and a breakdown by version (table with version, execution count, success rate, total cost per version). Below the stats, a table SHALL show the agent's 20 most recent events with columns: timestamp, skill name, version, status, duration, cost. Data SHALL come from `GET /v1/stats/agents/:name`.

#### Scenario: Agent detail loads from API

- GIVEN `/v1/agents/alpha` returns stats, 2 versions, and 10 recent events
- WHEN the user navigates to `/agents/alpha`
- THEN stat cards display agent metrics
- AND a version breakdown table shows 2 rows
- AND a recent events table shows 10 events

#### Scenario: Unknown agent shows error

- GIVEN `/v1/agents/nonexistent` returns 404
- WHEN the user navigates to `/agents/nonexistent`
- THEN an error message "Agent not found" is displayed

#### Scenario: Version breakdown is functional

- GIVEN the agent detail page with 2 versions
- WHEN the user views version breakdown
- THEN each row shows version, execution count, success rate, and total cost

#### Scenario: Back link to agents list

- GIVEN the agent detail page is displayed
- WHEN the user clicks "Back to Agents"
- THEN the URL changes to `/agents` and the agents table renders

## MODIFIED Requirements

### Requirement: Markdown Definition Viewer

The dashboard SHALL include a `/definitions` route listing Markdown definitions. Each row SHALL display: hash, entityType, entityName, version, description, and created date. The detail view at `/definitions/:hash` SHALL render the Markdown content using a Markdown renderer with syntax highlighting. The detail page SHALL display entity type, name, and version as heading, followed by the rendered Markdown body. (Previously: `version` was not included in the list or detail display)

#### Scenario: Definitions list shows version column

- GIVEN 3 definitions, one with version "1.0.0", two without
- WHEN the user navigates to `/definitions`
- THEN the table has a Version column showing "1.0.0" and "—"

#### Scenario: Definition detail shows version

- GIVEN a definition with `version = "2.1.0"`
- WHEN the user navigates to `/definitions/:hash`
- THEN the page header shows version "2.1.0"

### Requirement: Agent Evaluation Page

The dashboard SHALL include an `/agents` route rendering a table of agents. Each row SHALL display: agentName, version, execution count, success rate (%), average duration (ms), average cost ($), and total cost ($). Data SHALL come from `GET /v1/stats/agents`. The table SHALL be sortable by any numeric column. Default sort SHALL be execution count descending. Agent name and version columns MUST link to the agent detail page. (Previously: agent name linked to detail page but version column did not; no agent detail page existed)

#### Scenario: Agent name and version link to detail

- GIVEN the agents table is displayed
- WHEN the user clicks an agent name or version
- THEN the URL changes to `/agents/{agentName}` and the detail page renders

## RENAMED Requirements

(None)
