# Delta for Dashboard UI

## MODIFIED Requirements

### Requirement: Agent Evaluation Page

The dashboard SHALL include an `/agents` route rendering a table of agents. Each row SHALL display: agentName, version, execution count, success rate (%), average duration (ms), average cost ($), and total cost ($). Data SHALL come from `GET /v1/stats/agents`. The table SHALL be sortable by any numeric column (execution count, success rate, avg duration, avg cost, total cost). Default sort SHALL be execution count descending. Agent name and version columns MUST link to the agent detail page.

(Previously: agentName, version, execution count, success rate, avg duration, total cost; no avgCost, no links to detail page)

#### Scenario: Agent evaluation loads from API

- GIVEN `/v1/stats/agents` returns 5 agents with avgCost
- WHEN the user navigates to `/agents`
- THEN a table renders with 5 rows showing agent name, version, executions, success rate, avg duration, avg cost, and total cost

#### Scenario: Empty state

- GIVEN `/v1/stats/agents` returns no agents
- WHEN the user navigates to `/agents`
- THEN an empty-state message is displayed

#### Scenario: Sort by avg cost

- GIVEN agents with varying avgCost values
- WHEN the user clicks the Avg Cost column header
- THEN the table re-sorts by avg cost descending

#### Scenario: Agent name links to detail

- GIVEN the agents table is displayed
- WHEN the user clicks an agent name
- THEN the URL changes to `/agents/{agentName}` and the detail page renders

### Requirement: Skill Evaluation Page

The dashboard SHALL include a `/skills` route rendering a table of skills. Each row SHALL display: skillName, version, execution count, success rate (%), average cost ($), and total cost ($). Data SHALL come from `GET /v1/stats/skills`. The table SHALL be sortable by any numeric column (execution count, success rate, avg cost, total cost). Default sort SHALL be execution count descending. Skill name column MUST link to the skill detail page.

(Previously: skillName, version, execution count, success rate, total cost; no avgCost, no link to detail page)

#### Scenario: Skill evaluation loads from API

- GIVEN `/v1/stats/skills` returns 8 skills with avgCost
- WHEN the user navigates to `/skills`
- THEN a table renders with 8 rows showing skill name, version, executions, success rate, avg cost, and total cost

#### Scenario: Empty state

- GIVEN `/v1/stats/skills` returns no skills
- WHEN the user navigates to `/skills`
- THEN an empty-state message is displayed

#### Scenario: Sort by total cost

- GIVEN skills with varying totalCost values
- WHEN the user clicks the Total Cost column header
- THEN the table re-sorts by total cost ascending

#### Scenario: Skill name links to detail

- GIVEN the skills table is displayed
- WHEN the user clicks a skill name
- THEN the URL changes to `/skills/{skillName}` and the detail page renders

## ADDED Requirements

### Requirement: User Detail Page

The dashboard SHALL include a `/users/:userId` route rendering a detail page for a single user. The page SHALL display: userId, event count, distinct agents used, distinct skills used, total inputTokens, total outputTokens, total cachedTokens, total cost, first seen timestamp, and last seen timestamp. Below the stats cards, a table SHALL show the user's 20 most recent events with columns: timestamp, agent name, skill name, status, duration, cost. Data SHALL come from `GET /v1/users/:userId`.

#### Scenario: User detail loads from API

- GIVEN `/v1/users/u1` returns stats and 15 recent events
- WHEN the user navigates to `/users/u1`
- THEN stat cards display user metrics
- AND a table renders 15 recent events

#### Scenario: Unknown user shows error

- GIVEN `/v1/users/nonexistent` returns 404
- WHEN the user navigates to `/users/nonexistent`
- THEN an error message "User not found" is displayed

#### Scenario: Back link to users list

- GIVEN the user detail page is displayed
- WHEN the user clicks "Back to Users"
- THEN the URL changes to `/users` and the users table renders

### Requirement: Skill Detail Page

The dashboard SHALL include a `/skills/:skillName` route rendering a detail page for a single skill. The page SHALL display: skillName, execution count, success rate, avg duration, total cost, avg cost, and a breakdown by version (table with version, execution count, success rate, total cost per version). Below the stats, a table SHALL show the skill's 20 most recent events with columns: timestamp, agent name, version, status, duration, cost. Data SHALL come from `GET /v1/skills/:skillName`.

#### Scenario: Skill detail loads from API

- GIVEN `/v1/skills/research` returns stats, 2 versions, and 10 recent events
- WHEN the user navigates to `/skills/research`
- THEN stat cards display skill metrics
- AND a version breakdown table shows 2 rows
- AND a recent events table shows 10 events

#### Scenario: Unknown skill shows error

- GIVEN `/v1/skills/nonexistent` returns 404
- WHEN the user navigates to `/skills/nonexistent`
- THEN an error message "Skill not found" is displayed

#### Scenario: Version breakdown is functional

- GIVEN the skill detail page with 2 versions
- WHEN the user views version breakdown
- THEN each row shows version, execution count, success rate, and total cost

### Requirement: Sortable Columns on All Tables

All numeric columns on the Agent Evaluation, Skill Evaluation, User Evaluation, Events, and Sessions tables SHALL be sortable by clicking the column header. Clicking toggles sort direction (ascending, then descending). The currently sorted column MUST display a sort indicator (arrow). Tables SHALL support at least one sortable column.

#### Scenario: Toggle sort direction

- GIVEN the agents table sorted by execution count descending
- WHEN the user clicks the Execution Count header
- THEN the table re-sorts by execution count ascending

#### Scenario: Sort indicator visible

- GIVEN the agents table sorted by avg cost
- WHEN the table renders
- THEN the Avg Cost column header shows a sort arrow

#### Scenario: Non-numeric columns not sortable

- GIVEN the agents table
- WHEN the user clicks the Agent Name header
- THEN no sort is applied (name column is not sortable)

### Requirement: Markdown Definition Viewer

The dashboard SHALL include a `/definitions` route listing Markdown definitions. Each row SHALL display: hash, entityType, entityName, description, and created date. The detail view at `/definitions/:hash` SHALL render the Markdown content using a Markdown renderer (e.g., react-markdown) with syntax highlighting for code blocks. The detail page SHALL display entity type and name as heading, followed by the rendered Markdown body.

#### Scenario: Definitions list loads

- GIVEN 3 definitions exist
- WHEN the user navigates to `/definitions`
- THEN a table renders with 3 rows showing hash, entity type, entity name, description, and created date

#### Scenario: Definition detail renders markdown

- GIVEN a definition with `hash = "a1b2c3"` containing Markdown with headers and code blocks
- WHEN the user navigates to `/definitions/a1b2c3`
- THEN the Markdown is rendered as formatted HTML with syntax-highlighted code
- AND the page header shows entity type and entity name

#### Scenario: Unknown hash shows error

- GIVEN no definition with `hash = "z9y8x7"`
- WHEN the user navigates to `/definitions/z9y8x7`
- THEN an error message "Definition not found" is displayed
