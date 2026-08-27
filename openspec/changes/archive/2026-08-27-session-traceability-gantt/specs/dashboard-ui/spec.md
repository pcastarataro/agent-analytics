# Delta for Dashboard UI

## ADDED Requirements

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

Each event bar SHALL be colored by `eventType`: `session_created` = blue, `user_message` = green, `assistant_message` = purple, `tool_call` = orange, `skill_call` = teal, `unknown` = gray. A legend SHALL be visible.

#### Scenario: Color legend displayed

- GIVEN a session with mixed event types
- WHEN the Gantt renders
- THEN a color legend is visible showing each type and its color

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

### Requirement: TypeScript Types

New types `SessionSummary` and `SessionEvent` SHALL be defined in the API client types file. `SessionSummary` MUST include: `traceId`, `agentName`, `eventCount`, `firstEventAt`, `lastEventAt`, `durationMs`. `SessionEvent` MUST include: `id`, `eventType`, `agentName`, `timestamp`, `durationMs`, `status`, `execution`.

#### Scenario: Types match API response

- GIVEN the API returns a session list
- WHEN the client parses the response
- THEN the `SessionSummary[]` type matches the JSON shape

### Requirement: Test Coverage

Component tests MUST cover: (1) sessions table renders rows, (2) Gantt renders bars, (3) tooltip appears on hover, (4) navigation links work.

#### Scenario: Component tests pass

- GIVEN the dashboard test suite
- WHEN `vitest` runs
- THEN all session-related component tests pass
