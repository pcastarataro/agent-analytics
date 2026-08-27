# Dashboard UI Specification

## Purpose

React SPA that visualizes agent usage analytics from the agent-analytics API. Covers project scaffold, typed API client, navigation, and three views: Overview, Events, and Agent Detail.

## Requirements

### Requirement: Project Scaffold

The dashboard SHALL be a React 18 + Vite single-page application using TypeScript in strict mode and Tailwind CSS for styling. Vitest SHALL be the test runner with React Testing Library for component tests. The Vite dev server SHALL proxy `/v1/*` requests to `localhost:3000`.

#### Scenario: Dev server starts and proxies API

- GIVEN the developer runs `npm run dev` in `apps/dashboard/`
- WHEN Vite dev server starts
- THEN a request to `/v1/stats/overview` is proxied to `localhost:3000/v1/stats/overview`
- AND the page loads without console errors

#### Scenario: TypeScript strict mode catches implicit any

- GIVEN a developer writes a function without explicit return type
- WHEN `tsc --noEmit` runs
- THEN the compiler produces an error for the implicit `any`

### Requirement: Typed API Client

The system SHALL provide a typed `fetch` wrapper (no axios) that accepts a generic type parameter `T` and returns `Promise<T>`. Base URL SHALL be configurable via Vite environment variable or proxy. The client SHALL expose typed functions for GET `/v1/events`, GET `/v1/stats/overview`, and POST `/v1/events/batch`.

#### Scenario: Fetch wrapper returns typed response

- GIVEN the API returns a valid `StatsOverview` object from `/v1/stats/overview`
- WHEN the developer calls `fetchApi<StatsOverview>('/v1/stats/overview')`
- THEN the return type is `StatsOverview` with no type assertions

#### Scenario: Fetch wrapper rejects on non-2xx

- GIVEN the API returns HTTP 500 for a request
- WHEN the developer calls `fetchApi<unknown>('/v1/events')`
- THEN the promise rejects with an error containing the status code

### Requirement: Cost By Agent Chart

The Overview Page SHALL include a horizontal bar chart displaying `totalCost` per agent. The chart SHALL use recharts `BarChart` with `layout="vertical"`. The y-axis SHALL display agent names. The x-axis SHALL display cost values formatted as USD (`$X.XXXX`). Data SHALL come from `GET /v1/stats/agents`.

#### Scenario: Renders cost bars per agent

- GIVEN `/v1/stats/agents` returns agents with `totalCost` values
- WHEN the Overview page loads
- THEN a horizontal bar chart renders with one bar per agent
- AND each bar label shows the agent name on the y-axis
- AND each bar length reflects `totalCost` on the x-axis

#### Scenario: Cost formatted as USD

- GIVEN an agent with `totalCost: 12.3456`
- WHEN the chart renders
- THEN the cost axis label shows "$12.3456"

#### Scenario: Empty state when no agents or zero cost

- GIVEN `/v1/stats/agents` returns no agents or all agents have zero cost
- WHEN the Overview page loads
- THEN a "No cost data" message is displayed instead of the chart

#### Scenario: Zero-cost agents excluded from chart

- GIVEN agents where some have `totalCost: 0`
- WHEN the chart renders
- THEN agents with zero cost are not shown as bars

### Requirement: Overview Page

The Overview Page SHALL display (1) a total-events count card, (2) a bar chart of events grouped by agent name, and (3) a horizontal bar chart of cost grouped by agent name. Data for the events count and agent bar chart SHALL come from `GET /v1/stats/overview`. Data for the cost bar chart SHALL come from `GET /v1/stats/agents`.

#### Scenario: Renders overview data from API

- GIVEN `/v1/stats/overview` returns `{ totalEvents: 42, byAgent: [...] }`
- WHEN the user navigates to `/`
- THEN the total-events card displays "42"
- AND a bar chart renders with one bar per agent

#### Scenario: Renders cost chart from agents endpoint

- GIVEN `/v1/stats/agents` returns agents with cost data
- WHEN the user navigates to `/`
- THEN a horizontal cost-by-agent bar chart renders below the events charts

#### Scenario: Empty state when no events exist

- GIVEN `/v1/stats/overview` returns `{ totalEvents: 0 }`
- WHEN the user navigates to `/`
- THEN an empty-state message is displayed instead of charts

### Requirement: Events Page

The Events Page SHALL display a filterable, paginated table of `UsageEvent` records. Columns SHALL include: timestamp, agentName, agentVersion, skillVersion, model, status, sessionId, promptLength, responseLength. Pagination SHALL use cursor-based load-more. The table MUST deduplicate events by `event.id` — no duplicate rows SHALL appear for the same event ID.

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

### Requirement: Navigation

The system SHALL use react-router v6 with a sidebar or tab-based layout providing links to Overview (`/`), Events (`/events`), Agents (`/agents`), Skills (`/skills`), and Users (`/users`). The active route SHALL be visually highlighted.

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

### Requirement: Agent Evaluation Page

The dashboard SHALL include an `/agents` route rendering a table of agents. Each row SHALL display: agentName, version, execution count, success rate (%), average duration (ms), average cost ($), and total cost ($). Data SHALL come from `GET /v1/stats/agents`. The table SHALL be sortable by any numeric column. Default sort SHALL be execution count descending. Agent name and version columns MUST link to the agent detail page. (Previously: agent name linked to detail page but version column did not; no agent detail page existed)

#### Scenario: Agent name and version link to detail

- GIVEN the agents table is displayed
- WHEN the user clicks an agent name or version
- THEN the URL changes to `/agents/{agentName}` and the detail page renders

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

### Requirement: User Evaluation Page

The dashboard SHALL include a `/users` route rendering a table of users. Each row SHALL display: userId, event count, distinct agents used, distinct skills used, total inputTokens, total outputTokens, total cachedTokens, total cost, first seen timestamp, last seen timestamp. Token and cost columns SHALL show SUM aggregations across all events for that user. Data SHALL come from `GET /v1/stats/users`. The table SHALL be sortable by any column. Default sort SHALL be event count descending.

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

The dashboard SHALL include a `/definitions` route listing Markdown definitions. Each row SHALL display: hash, entityType, entityName, version, description, and created date. The detail view at `/definitions/:hash` SHALL render the Markdown content using a Markdown renderer with syntax highlighting. The detail page SHALL display entity type, name, and version as heading, followed by the rendered Markdown body. (Previously: `version` was not included in the list or detail display)

#### Scenario: Definitions list shows version column

- GIVEN 3 definitions, one with version "1.0.0", two without
- WHEN the user navigates to `/definitions`
- THEN the table has a Version column showing "1.0.0" and "—"

#### Scenario: Definition detail shows version

- GIVEN a definition with `version = "2.1.0"`
- WHEN the user navigates to `/definitions/:hash`
- THEN the page header shows version "2.1.0"

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

### Requirement: Error and Loading States

Every page SHALL display a loading spinner while API data is in flight. On API failure, an error message SHALL be shown with a retry action. An error boundary SHALL catch unhandled rendering errors and display a fallback UI.

#### Scenario: API error shows retry option

- GIVEN the API is unreachable
- WHEN the Overview page loads
- THEN an error message is displayed
- AND a "Retry" button is present
- WHEN the user clicks "Retry"
- THEN the API call is re-attempted

#### Scenario: Loading state during fetch

- GIVEN the API has not yet responded
- WHEN a page renders
- THEN a loading indicator is displayed
- AND no data-dependent content is visible

### Requirement: Sessions List Page

The dashboard SHALL include a `/sessions` route rendering a sortable table of sessions. Columns: `traceId` (truncated), `Agent Name`, `Events`, `Started` (firstEventAt, relative), `Duration` (human-readable). Default sort: `Started` descending. Rows MUST be clickable, navigating to `/sessions/:id`.

#### Scenario: Sessions page loads from API

- GIVEN `/v1/sessions` returns 15 sessions
- WHEN the user navigates to `/sessions`
- THEN a table renders with 15 rows showing agent name, event count, start time, and duration

#### Scenario: Click session navigates to detail

- GIVEN the sessions table is displayed
- WHEN the user clicks a row
- THEN the URL changes to `/sessions/{traceId}` and the detail page renders

#### Scenario: Empty state

- GIVEN `/v1/sessions` returns no sessions
- WHEN the user navigates to `/sessions`
- THEN an empty-state message is displayed

### Requirement: Session Detail Page with Gantt

The dashboard SHALL include a `/sessions/:id` route rendering a custom SVG Gantt timeline of events. The page SHALL display session metadata (agent name, total duration, event count) above the Gantt.

#### Scenario: Gantt renders event bars

- GIVEN a session with 10 events of varying durations
- WHEN the user navigates to `/sessions/:id`
- THEN a Gantt chart renders with 10 horizontal bars positioned by timestamp

#### Scenario: Zero-duration events render as dots

- GIVEN a session with instant events (durationMs = 0)
- WHEN the Gantt renders
- THEN zero-duration events appear as small circle markers (not bars)

### Requirement: Gantt Time Axis

The Gantt component SHALL render a horizontal time axis with adaptive granularity: auto-scale labels from milliseconds to minutes based on session duration. Tick marks SHALL align with human-readable intervals.

#### Scenario: Short session shows millisecond axis

- GIVEN a session lasting 500ms
- WHEN the Gantt renders
- THEN time axis labels show millisecond granularity

#### Scenario: Long session shows minute axis

- GIVEN a session lasting 30 minutes
- WHEN the Gantt renders
- THEN time axis labels show minute granularity

### Requirement: Gantt Event Color Coding

Each event bar SHALL be colored by `eventType`: `session_created` = blue, `user_message` = green, `assistant_message` = purple, `tool_call` = orange, `skill_call` = teal, `unknown` = gray. A single shared `EVENT_COLORS` constant SHALL define the mapping used by both the Gantt chart bars and the tooltip. A legend SHALL be visible.

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

#### Scenario: Time axis visible during scroll

- GIVEN a session with 50 events causing vertical overflow
- WHEN the user scrolls the event area
- THEN the time-axis header remains fixed at the top
- AND the legend footer remains fixed at the bottom

#### Scenario: Short sessions render normally

- GIVEN a session with 3 events (no overflow)
- WHEN the Gantt renders
- THEN the layout is identical to previous behavior (no visual regression)

### Requirement: Gantt Sub-Session Indentation

Events with `execution.parentId` SHALL be rendered on an indented row below their parent execution. Indentation SHALL be recursive for nested sub-sessions. The parent-child relationship uses the existing `execution.parentId` field.

#### Scenario: Child session indented

- GIVEN a session with a parent and child execution
- WHEN the Gantt renders
- THEN child events appear indented below the parent events

### Requirement: Gantt Tooltip on Hover

Hovering over an event bar SHALL display a tooltip with: event type, agent name, start time, duration, status. The tooltip MUST NOT overlap the Gantt area.

#### Scenario: Tooltip shows event details

- GIVEN a Gantt event bar
- WHEN the user hovers over it
- THEN a tooltip appears showing event type, agent, start time, duration, and status

### Requirement: Navigation Update

The sidebar nav SHALL include a "Sessions" link pointing to `/sessions`. The active route highlighting MUST work for both `/sessions` and `/sessions/:id`.

#### Scenario: Sessions nav link visible

- GIVEN the dashboard is loaded
- WHEN the sidebar renders
- THEN a "Sessions" link is present and navigates to `/sessions`

#### Scenario: Active state on session detail

- GIVEN the user is on `/sessions/abc-123`
- WHEN the sidebar renders
- THEN the "Sessions" link is highlighted as active

### Requirement: TypeScript Types for Sessions

New types `SessionSummary` and `SessionEvent` SHALL be defined in the API client types file. `SessionSummary` MUST include: `traceId`, `agentName`, `eventCount`, `firstEventAt`, `lastEventAt`, `durationMs`. `SessionEvent` MUST include: `id`, `eventType`, `agentName`, `timestamp`, `durationMs`, `status`, `execution`.

#### Scenario: Types match API response

- GIVEN the API returns a session list
- WHEN the client parses the response
- THEN the `SessionSummary[]` type matches the JSON shape

### Requirement: Responsive Layout

The layout SHALL be desktop-first. The sidebar or tabs SHALL remain functional at viewport widths down to 768px. Tables SHALL scroll horizontally when columns overflow.

#### Scenario: Sidebar collapses on narrow viewport

- GIVEN the viewport width is 768px
- WHEN the dashboard renders
- THEN the sidebar remains accessible and the main content area is not overlapped
- AND tables are horizontally scrollable
