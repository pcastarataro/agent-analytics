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

### Requirement: Overview Page

The Overview Page SHALL display (1) a total-events count card, (2) a bar chart of events grouped by agent name, and (3) a donut chart of events grouped by status. All data SHALL come from `GET /v1/stats/overview`.

#### Scenario: Renders overview data from API

- GIVEN `/v1/stats/overview` returns `{ totalEvents: 42, byAgent: [...], byStatus: [...] }`
- WHEN the user navigates to `/`
- THEN the total-events card displays "42"
- AND a bar chart renders with one bar per agent
- AND a donut chart renders with one segment per status

#### Scenario: Empty state when no events exist

- GIVEN `/v1/stats/overview` returns `{ totalEvents: 0 }`
- WHEN the user navigates to `/`
- THEN an empty-state message is displayed instead of charts

### Requirement: Events Page

The Events Page SHALL display a filterable, paginated table of `UsageEvent` records. Columns SHALL include: timestamp, agentName, status, sessionId, promptLength, responseLength. Pagination SHALL use cursor-based load-more.

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

### Requirement: Navigation

The system SHALL use react-router v6 with a sidebar or tab-based layout providing links to Overview (`/`) and Events (`/events`). The active route SHALL be visually highlighted.

#### Scenario: Route navigation

- GIVEN the user is on the Overview page
- WHEN the user clicks the Events link in the sidebar
- THEN the URL changes to `/events`
- AND the Events page content is rendered

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
