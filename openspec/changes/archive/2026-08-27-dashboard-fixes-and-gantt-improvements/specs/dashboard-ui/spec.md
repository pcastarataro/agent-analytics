# Delta for Dashboard UI

## MODIFIED Requirements

### Requirement: Events Page

The Events Page SHALL display a filterable, paginated table of `UsageEvent` records. Columns SHALL include: timestamp, agentName, agentVersion, skillVersion, model, status, sessionId, promptLength, responseLength. Pagination SHALL use cursor-based load-more. The table MUST deduplicate events by `event.id` — no duplicate rows SHALL appear for the same event ID.

(Previously: Model column read from `model.name`; no explicit fallbacks for version fields.)

#### Scenario: Model displayed in table

- GIVEN an event with `model.id = "claude-sonnet-4-20250514"`
- WHEN the Events table renders
- THEN the Model column shows "claude-sonnet-4-20250514"

#### Scenario: Model fallback when missing

- GIVEN an event with `model` undefined or null
- WHEN the Events table renders
- THEN the Model column shows "—"

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

#### Scenario: Paginated event loading

- GIVEN the API returns 50 events with a `nextCursor`
- WHEN the user views the Events page
- THEN the first 50 events are displayed
- AND a "Load More" button is visible

#### Scenario: Filter by agent name

- GIVEN events exist for agents "alpha" and "beta"
- WHEN the user selects agent "alpha" from the filter
- THEN only events where `agentName === "alpha"` are displayed

### Requirement: User Evaluation Page

The dashboard SHALL include a `/users` route rendering a table of users. Each row SHALL display: userId, event count, distinct agents used, distinct skills used, total inputTokens, total outputTokens, total cachedTokens, total cost, first seen timestamp, last seen timestamp. Token and cost columns SHALL show SUM aggregations across all events for that user. Data SHALL come from `GET /v1/stats/users`. The table SHALL be sortable by any column. Default sort SHALL be event count descending.

(Previously: No token or cost columns — only event count, distinct agents/skills, first/last seen.)

#### Scenario: User evaluation loads from API

- GIVEN `/v1/stats/users` returns 12 users with token/cost fields
- WHEN the user navigates to `/users`
- THEN a table renders with 12 rows showing user ID, events, agent count, skill count, inputTokens, outputTokens, cachedTokens, cost, first seen, and last seen

#### Scenario: Token totals are SUM aggregations

- GIVEN user "u1" with 3 events having inputTokens: 100, 200, 300
- WHEN the User table renders
- THEN user "u1" shows inputTokens = 600

#### Scenario: Cost totals are SUM aggregations

- GIVEN user "u1" with 2 events having cost: 0.05 and 0.03
- WHEN the User table renders
- THEN user "u1" shows cost = 0.08

#### Scenario: Empty state

- GIVEN `/v1/stats/users` returns no users
- WHEN the user navigates to `/users`
- THEN an empty-state message is displayed

#### Scenario: Unknown user fallback

- GIVEN events where `actor.userId` was not populated (collector fallback)
- WHEN the User Evaluation table renders
- THEN those events aggregate under a row with userId "unknown"

### Requirement: Gantt Event Color Coding

Each event bar SHALL be colored by `eventType`: `session_created` = blue, `user_message` = green, `assistant_message` = purple, `tool_call` = orange, `skill_call` = teal, `unknown` = gray. A single shared `EVENT_COLORS` constant SHALL define the mapping used by both the Gantt chart bars and the tooltip. A legend SHALL be visible.

(Previously: Separate color maps in GanttChart and GanttTooltip caused mismatched colors.)

#### Scenario: Color legend displayed

- GIVEN a session with mixed event types
- WHEN the Gantt renders
- THEN a color legend is visible showing each type and its color

#### Scenario: Tooltip colors match chart colors

- GIVEN a `tool_call` event bar rendered in orange
- WHEN the user hovers over it
- THEN the tooltip uses the same orange from `EVENT_COLORS`

### Requirement: Gantt Row Labels with Context

Gantt row labels SHALL include contextual information identifying each event. For `tool_call` events, the label SHALL show the tool name. For `skill_call` events, the label SHALL show the skill name. For other events, the label SHALL show the model or event type. Labels MUST be readable and not overflow the row.

(Previously: Row labels showed only event type, making tool_call/skill_call events indistinguishable.)

#### Scenario: Tool call row shows tool name

- GIVEN a `tool_call` event with tool name "web_search"
- WHEN the Gantt renders
- THEN the row label shows "web_search"

#### Scenario: Skill call row shows skill name

- GIVEN a `skill_call` event with skill name "research"
- WHEN the Gantt renders
- THEN the row label shows "research"

#### Scenario: Other events show event type

- GIVEN a `user_message` event
- WHEN the Gantt renders
- THEN the row label shows "user_message"

### Requirement: Gantt Sticky Header and Footer

The Gantt component SHALL render a sticky time-axis header at the top and a sticky legend footer at the bottom. The middle section containing event bars SHALL be independently scrollable. The sticky elements MUST remain visible while scrolling vertically through events.

(Previously: No sticky elements — time axis and legend scrolled out of view on long sessions.)

#### Scenario: Time axis visible during scroll

- GIVEN a session with 50 events causing vertical overflow
- WHEN the user scrolls the event area
- THEN the time-axis header remains fixed at the top
- AND the legend footer remains fixed at the bottom

#### Scenario: Short sessions render normally

- GIVEN a session with 3 events (no overflow)
- WHEN the Gantt renders
- THEN the layout is identical to previous behavior (no visual regression)
