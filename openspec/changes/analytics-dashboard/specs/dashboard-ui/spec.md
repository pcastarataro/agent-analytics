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

### Requirement: Responsive Layout

The layout SHALL be desktop-first. The sidebar or tabs SHALL remain functional at viewport widths down to 768px. Tables SHALL scroll horizontally when columns overflow.

#### Scenario: Sidebar collapses on narrow viewport

- GIVEN the viewport width is 768px
- WHEN the dashboard renders
- THEN the sidebar remains accessible and the main content area is not overlapped
- AND tables are horizontally scrollable
