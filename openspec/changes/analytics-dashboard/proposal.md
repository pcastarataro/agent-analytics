# Proposal: analytics-dashboard

## Intent

C1–C3 deliver event ingestion, collection, and a REST API with aggregate stats. There is no way to visualize this data. The `apps/dashboard/` stub exists but has zero React/Vite/charts. We need a working SPA to surface agent usage analytics.

## Scope

### In Scope
- React 18 + Vite SPA scaffold (replaces `apps/dashboard/` stub)
- Tailwind CSS styling, desktop-first
- recharts for line, bar, and donut charts
- react-router v6 for URL-based navigation
- Typed `fetch` wrapper (`useApi<T>` hook, no axios)
- 3 views: Overview, Events, Agent Detail
- Vite dev proxy to API (`/v1/*` → `localhost:3000`)
- Vitest + React Testing Library unit tests

### Out of Scope
- Authentication (API key auth is a stub in C3)
- Real-time updates (WebSocket/SSE)
- Mobile responsive (desktop-first)
- Export/download features
- Admin features
- Production deployment

## Capabilities

### New Capabilities
- `dashboard-ui`: React SPA scaffold, routing, layout, Vite build, Tailwind styling, API client hook
- `dashboard-overview`: Overview page — stats cards, events-over-time line chart, by-agent bar, by-status donut
- `dashboard-events`: Events page — filterable paginated table with cursor-based load-more
- `dashboard-agent-detail`: Agent Detail page — per-agent token/cost charts, skill breakdown

### Modified Capabilities
None — no existing spec-level behavior changes.

## Approach

React 18 + Vite SPA with local state only (`useState` + custom hooks). No global state library. recharts for all charts. fetch wrapper ~30 lines for typed API calls. 3 chained PRs, each under the 400-line review budget:

**Slice 1** (~330 lines): Scaffold — Vite config, Tailwind, react-router layout, `useApi` hook, Overview page with all 3 charts.

**Slice 2** (~330 lines): Events page — `FilterBar`, `EventTable`, cursor-based pagination, shared API types.

**Slice 3** (~280 lines): Agent Detail page — per-agent charts, unit tests for Overview and AgentDetail, README.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `apps/dashboard/` | Modified | Full SPA implementation replacing stub |
| `apps/dashboard/package.json` | Modified | Add React, Vite, Tailwind, recharts, react-router, vitest deps |
| Root `package.json` | Modified | Add `dev`, `build`, `preview` scripts for dashboard |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| API lacks timeseries endpoint (tokens/cost over time) | High | Use existing `/v1/stats/overview` for aggregate charts; Agent Detail shows only available data, add endpoint later |
| Bundle size (~100KB gzipped with React+recharts) | Low | Vite tree-shaking + Tailwind purging. Acceptable for internal dev tool |
| Vite dev proxy config conflicts with existing workspace | Low | Dashboard gets its own `vite.config.ts`; proxy only in dev mode, no production impact |

## Rollback Plan

Each slice is a standalone PR targeting `main`. Revert any single slice by reverting its PR commit — no cross-slice dependencies. Slice 3 tests run independently of slices 1–2 data.

## Dependencies

- C3 API endpoints must be running (GET `/v1/events`, GET `/v1/stats/overview`)
- Node 18+ (already required by monorepo)

## Success Criteria

- [ ] `npm run dev` in `apps/dashboard/` starts Vite dev server with hot reload
- [ ] Overview page renders 3 charts from `/v1/stats/overview`
- [ ] Events page shows paginated table with agent/status filters
- [ ] Agent Detail page shows per-agent breakdown
- [ ] All slices under 400 changed lines each
- [ ] Vitest passes for all components
