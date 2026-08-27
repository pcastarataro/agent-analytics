# Tasks: analytics-dashboard

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~940 total (3 slices: ~330, ~330, ~280) |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 → PR 2 → PR 3 (stacked-to-main) |
| Delivery strategy | ask-on-risk |
| Chain strategy | stacked-to-main |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|------|------|-----------|----------------------|-----------------|-------------------|
| 1 | Scaffold + Overview page | PR 1 | `npm run dev` — loads Overview at `/` | Vite dev server with proxy to `localhost:3000` | All files under `apps/dashboard/src/` — full revert, no external deps |
| 2 | Events page | PR 2 | `npm run dev` — navigate to `/events`, paginate, filter | Vite dev server; manual or Cypress-like check | `src/pages/EventsPage.tsx`, `src/components/FilterBar.tsx`, `src/components/EventTable.tsx`, route addition in `App.tsx` |
| 3 | Agent Detail + Tests | PR 3 | `npx vitest run` | Vitest runner in `apps/dashboard/` | `src/pages/AgentDetailPage.tsx`, route in `App.tsx`, `__tests__/` directory |

## Phase 1: Scaffold + Overview (PR 1)

- [x] 1.1 Rewrite `apps/dashboard/package.json` — add React 18, Vite, Tailwind, recharts, react-router-dom, vitest, @testing-library/react deps
- [x] 1.2 Rewrite `apps/dashboard/tsconfig.json` — Vite-appropriate TS config with `"jsx": "react-jsx"`, strict mode
- [x] 1.3 Create `apps/dashboard/vite.config.ts` — React plugin + `/v1` proxy to `localhost:3000`
- [x] 1.4 Create `apps/dashboard/postcss.config.js` — Tailwind + autoprefixer plugins
- [x] 1.5 Create `apps/dashboard/tailwind.config.ts` — content paths for `src/**/*.{ts,tsx}`
- [x] 1.6 Create `apps/dashboard/index.html` — Vite entry HTML with `<div id="root">`
- [x] 1.7 Create `apps/dashboard/src/main.tsx` — React root mount into `#root`
- [x] 1.8 Create `apps/dashboard/src/index.css` — Tailwind `@tailwind base/components/utilities` directives
- [x] 1.9 Create `apps/dashboard/src/api/types.ts` — `StatsOverview`, `UsageEventDTO`, `PaginatedEvents`, `EventFilters` interfaces
- [x] 1.10 Create `apps/dashboard/src/api/client.ts` — `fetchApi<T>(path, init?)` typed fetch wrapper (~30 lines, rejects on non-2xx)
- [x] 1.11 Create `apps/dashboard/src/hooks/useApi.ts` — `useApi<T>(url)` hook returning `{ data, loading, error, refetch }`
- [x] 1.12 Create `apps/dashboard/src/components/Layout.tsx` — sidebar nav with links to `/` (Overview) and `/events` (Events), `<Outlet>` for content, active route highlight
- [x] 1.13 Create `apps/dashboard/src/components/ErrorBoundary.tsx` — React error boundary with fallback UI
- [x] 1.14 Create `apps/dashboard/src/components/LoadingSpinner.tsx` — shared loading indicator
- [x] 1.15 Create `apps/dashboard/src/components/ErrorMessage.tsx` — error display with "Retry" button calling `refetch`
- [x] 1.16 Create `apps/dashboard/src/pages/OverviewPage.tsx` — fetches `/v1/stats/overview`, renders StatsCard + charts; empty-state when `total === 0`
- [x] 1.17 Create `apps/dashboard/src/pages/OverviewPage/StatsCard.tsx` — total-events count card
- [x] 1.18 Create `apps/dashboard/src/pages/OverviewPage/EventsByAgent.tsx` — recharts `<BarChart>` from `byAgent` Record → `[{name, count}]`
- [x] 1.19 Create `apps/dashboard/src/pages/OverviewPage/EventsByStatus.tsx` — recharts `<PieChart>` donut from `byStatus` Record → `[{name, value}]`
- [x] 1.20 Create `apps/dashboard/src/pages/OverviewPage/EventsOverTime.tsx` — recharts `<LineChart>` from `byDate` Record → `[{date, count}]`
- [x] 1.21 Create `apps/dashboard/src/App.tsx` — `BrowserRouter` + `Routes` with `Layout` wrapper and `/` → `OverviewPage` route
- [x] 1.22 Delete `apps/dashboard/src/index.ts` — replaced by React entry point
- [x] 1.23 Run `npm install` in `apps/dashboard/` and verify `npm run dev` starts Vite without errors; `tsc --noEmit` passes

## Phase 2: Events Page (PR 2)

- [x] 2.1 Create `apps/dashboard/src/components/FilterBar.tsx` — agent name select/dropdown and status filter controls
- [x] 2.2 Create `apps/dashboard/src/components/EventTable.tsx` — paginated table (timestamp, agentName, status, sessionId, promptLength, responseLength) with horizontal scroll on overflow
- [x] 2.3 Create `apps/dashboard/src/pages/EventsPage.tsx` — integrates FilterBar + EventTable, cursor-based "Load More" pagination, fetches `/v1/events` with query params
- [x] 2.4 Update `apps/dashboard/src/App.tsx` — add `/events` route pointing to `EventsPage`

## Phase 3: Agent Detail + Tests (PR 3)

- [x] 3.1 Create `apps/dashboard/src/pages/AgentDetailPage.tsx` — per-agent breakdown: tokens-per-agent bar chart, events-over-time line chart, skill breakdown; fetches agent-filtered data
- [x] 3.2 Update `apps/dashboard/src/App.tsx` — add `/agents/:name` route pointing to `AgentDetailPage`
- [x] 3.3 Create `apps/dashboard/__tests__/api/client.test.ts` — test `fetchApi` returns typed response on 200; rejects with status on non-2xx
- [x] 3.4 Create `apps/dashboard/__tests__/hooks/useApi.test.tsx` — test hook returns `data` on success, `error` on failure, `loading` during fetch
- [x] 3.5 Create `apps/dashboard/__tests__/pages/OverviewPage.test.tsx` — renders stats card + charts from mock data; shows empty state when `totalEvents === 0`
- [x] 3.6 Create `apps/dashboard/__tests__/pages/AgentDetailPage.test.tsx` — renders per-agent charts from mock data

## Spec Traceability Matrix

| Spec Scenario | Task(s) |
|---------------|---------|
| Dev server starts and proxies API | 1.3, 1.23 |
| TypeScript strict mode catches implicit any | 1.2, 1.23 |
| Fetch wrapper returns typed response | 1.9, 1.10, 3.3 |
| Fetch wrapper rejects on non-2xx | 1.10, 3.3 |
| Renders overview data from API | 1.16–1.20, 3.5 |
| Empty state when no events exist | 1.16, 3.5 |
| Paginated event loading | 2.2, 2.3 |
| Filter by agent name | 2.1, 2.3 |
| Route navigation | 1.12, 1.21, 2.4, 3.2 |
| API error shows retry option | 1.15 |
| Loading state during fetch | 1.11, 1.14 |
| Sidebar collapses on narrow viewport | 1.12 |

## Next Step

Ready for `sdd-apply`. User must decide chain strategy (stacked-to-main recommended) before apply begins.
