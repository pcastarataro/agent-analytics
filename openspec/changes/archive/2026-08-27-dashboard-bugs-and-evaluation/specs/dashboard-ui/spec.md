# Delta for Dashboard UI

## MODIFIED Requirements

### Requirement: Events Page

The Events Page SHALL display a filterable, paginated table of `UsageEvent` records. Columns SHALL include: timestamp, agentName, agentVersion, skillVersion, model, status, sessionId, promptLength, responseLength. Pagination SHALL use cursor-based load-more. The table MUST deduplicate events by `event.id` — no duplicate rows SHALL appear for the same event ID.
(Previously: Columns were timestamp, agentName, status, sessionId, promptLength, responseLength. No deduplication guarantee. No agentVersion, skillVersion, or model columns.)

#### Scenario: Paginated event loading

- GIVEN the API returns 50 events with a `nextCursor`
- WHEN the user views the Events page
- THEN the first 50 events are displayed
- AND a "Load More" button is visible
- WHEN the user clicks "Load More"
- THEN the next page of events is appended to the table

#### Scenario: Filter by agent name

- GIVEN events exist for agents "alpha" and "beta"
- WHEN the user selects agent "alpha" from the filter
- THEN only events where `agentName === "alpha"` are displayed

#### Scenario: Agent version displayed in table

- GIVEN an event with `agent.version = "1.2.0"`
- WHEN the Events table renders
- THEN the Agent Version column shows "1.2.0"

#### Scenario: Agent version fallback when missing

- GIVEN an event with `agent.version` undefined or null
- WHEN the Events table renders
- THEN the Agent Version column shows "—"

#### Scenario: Skill version displayed in table

- GIVEN an event with `skill.version = "0.3.1"`
- WHEN the Events table renders
- THEN the Skill Version column shows "0.3.1"

#### Scenario: Skill version fallback when missing

- GIVEN an event with `skill.version` undefined or null
- WHEN the Events table renders
- THEN the Skill Version column shows "—"

#### Scenario: Model displayed in table

- GIVEN an event with `model.name = "claude-sonnet-4-20250514"`
- WHEN the Events table renders
- THEN the Model column shows "claude-sonnet-4-20250514"

#### Scenario: Model fallback when missing

- GIVEN an event with `model` undefined or null
- WHEN the Events table renders
- THEN the Model column shows "—"

#### Scenario: No duplicate events after dedup fix

- GIVEN two events with different `id` values but identical `contentHash`
- WHEN the Events table renders
- THEN both events appear as distinct rows (no dedup by contentHash alone)

#### Scenario: Dedup by event.id

- GIVEN the same event received twice (same `id`)
- WHEN the Events table renders
- THEN only one row appears for that event ID

### Requirement: Navigation

The system SHALL use react-router v6 with a sidebar or tab-based layout providing links to Overview (`/`), Events (`/events`), Agents (`/agents`), Skills (`/skills`), and Users (`/users`). The active route SHALL be visually highlighted.
(Previously: Navigation included only Overview and Events links.)

#### Scenario: Route navigation

- GIVEN the user is on the Overview page
- WHEN the user clicks the Events link in the sidebar
- THEN the URL changes to `/events`
- AND the Events page content is rendered

#### Scenario: Agents nav link visible

- GIVEN the dashboard is loaded
- WHEN the sidebar renders
- THEN an "Agents" link is present and navigates to `/agents`

#### Scenario: Skills nav link visible

- GIVEN the dashboard is loaded
- WHEN the sidebar renders
- THEN a "Skills" link is present and navigates to `/skills`

#### Scenario: Users nav link visible

- GIVEN the dashboard is loaded
- WHEN the sidebar renders
- THEN a "Users" link is present and navigates to `/users`

## ADDED Requirements

### Requirement: Agent Evaluation Page

The dashboard SHALL include an `/agents` route rendering a table of agents. Each row SHALL display: agentName, version, execution count, success rate (%), average duration (ms), and total cost ($). Data SHALL come from `GET /v1/stats/agents`. The table SHALL be sortable by any column. Default sort SHALL be execution count descending.

#### Scenario: Agent evaluation loads from API

- GIVEN `/v1/stats/agents` returns 5 agents
- WHEN the user navigates to `/agents`
- THEN a table renders with 5 rows showing agent name, version, executions, success rate, avg duration, and cost

#### Scenario: Empty state

- GIVEN `/v1/stats/agents` returns no agents
- WHEN the user navigates to `/agents`
- THEN an empty-state message is displayed

#### Scenario: Sort by success rate

- GIVEN agents with varying success rates
- WHEN the user clicks the Success Rate column header
- THEN the table re-sorts by success rate descending

### Requirement: Skill Evaluation Page

The dashboard SHALL include a `/skills` route rendering a table of skills. Each row SHALL display: skillName, version, execution count, success rate (%), and total cost ($). Data SHALL come from `GET /v1/stats/skills`. The table SHALL be sortable by any column. Default sort SHALL be execution count descending.

#### Scenario: Skill evaluation loads from API

- GIVEN `/v1/stats/skills` returns 8 skills
- WHEN the user navigates to `/skills`
- THEN a table renders with 8 rows showing skill name, version, executions, success rate, and cost

#### Scenario: Empty state

- GIVEN `/v1/stats/skills` returns no skills
- WHEN the user navigates to `/skills`
- THEN an empty-state message is displayed

### Requirement: User Evaluation Page

The dashboard SHALL include a `/users` route rendering a table of users. Each row SHALL display: userId, event count, distinct agents used, distinct skills used, first seen timestamp, last seen timestamp. Data SHALL come from `GET /v1/stats/users`. The table SHALL be sortable by any column. Default sort SHALL be event count descending.

#### Scenario: User evaluation loads from API

- GIVEN `/v1/stats/users` returns 12 users
- WHEN the user navigates to `/users`
- THEN a table renders with 12 rows showing user ID, events, agent count, skill count, first seen, and last seen

#### Scenario: Empty state

- GIVEN `/v1/stats/users` returns no users
- WHEN the user navigates to `/users`
- THEN an empty-state message is displayed

#### Scenario: Unknown user fallback

- GIVEN events where `actor.userId` was not populated (collector fallback)
- WHEN the User Evaluation table renders
- THEN those events aggregate under a row with userId "unknown"
