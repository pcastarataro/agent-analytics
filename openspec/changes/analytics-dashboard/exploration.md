# Exploration: analytics-dashboard (C4)

Date: 2026-08-26 - Phase: sdd-explore - Store: openspec - Review budget: 400 lines/slice
Sources: archived C1/C2/C3 specs + code, repo state, API endpoint contract analysis.

## Current State

C1 (event-schema), C2 (collector-plugin), C3 (api-database-persistence) are complete and archived.

The API provides three endpoints:
- `POST /v1/events/batch` - batch ingestion (collector-facing)
- `GET /v1/events` - paginated event list with filters (agentName, sessionId, status, date range)
- `GET /v1/stats/overview` - aggregate stats (total, byAgent, byStatus, byDate)

Response shapes from C3:

```
GET /v1/events => { data: UsageEvent[], nextCursor: string | null }
GET /v1/stats/overview => { total, byAgent, byStatus, byDate } (all Record<string, number>)
```

Repo has npm workspaces + TS strict + Jest/@swc/jest + ESLint flat.

The `apps/dashboard/` directory exists but is a stub:
- `package.json` - only depends on `@agent-analytics/shared`
- `src/index.ts` - exports package name and dependency helper
- `src/__tests__/index.test.ts` - skeleton test
- No React, no Vite, no charting libs, no routing installed

## Affected Areas

- `apps/dashboard/` - will become the full React SPA
- `packages/shared/` - may need shared API client types
- Root `package.json` - dashboard already in workspaces, may need root scripts
- `tsconfig.json` - already includes `apps/dashboard/src/**/*.ts`

## Gap 1 - Framework: React vs Preact vs Vanilla

| Approach | Pros | Cons | Complexity |
|----------|------|------|------------|
| React | Industry standard, ecosystem, tooling | Larger bundle (~40KB gz) | Low |
| Preact | Tiny bundle (~3KB), React-compatible API | Smaller ecosystem, compat gaps | Low |
| Vanilla + Web Components | No framework overhead | Slow dev, no component ecosystem | Med |

**Recommendation: React.** Standard SPA, not consumer-facing. Ecosystem wins.

## Gap 2 - Build Tool: Vite vs Next.js vs plain

| Approach | Pros | Cons | Complexity |
|----------|------|------|------------|
| Vite | Fast HMR, zero config React+TS, small output | No SSR (not needed) | Low |
| Next.js | File-based routing, SSR | Overkill for dashboard SPA | High |
| Plain webpack/tsc | Full control | Slow dev experience | Med |

**Recommendation: Vite.** Zero-config React+TS SPA. Fast dev, fast builds.

## Gap 3 - Charting: recharts vs chart.js vs nivo

| Approach | Pros | Cons | Complexity |
|----------|------|------|------------|
| recharts | React-native API, declarative, SVG | Fewer chart types | Low |
| chart.js + react-chartjs-2 | Battle-tested, many types, canvas | Less React-idiomatic | Low |
| nivo | Beautiful defaults, many types, D3-based | Larger bundle, complex API | Med |

**Recommendation: recharts.** Best React integration for time-series, bar, pie charts.

## Gap 4 - Routing: react-router vs file-based vs state

| Approach | Pros | Cons | Complexity |
|----------|------|------|------------|
| react-router v6 | Standard, URL navigation, deep linking | Adds dep | Low |
| File-based | Convention over config | Requires framework support | Med |
| State-based | No lib, simple | No URL sync, no back/forward | Low |

**Recommendation: react-router v6.** URL navigation expected UX for dashboards.

## Gap 5 - State: local state vs react-query vs zustand

| Approach | Pros | Cons | Complexity |
|----------|------|------|------------|
| Local state (useState + fetch hook) | No deps, simple, sufficient | Manual loading/error, no caching | Low |
| react-query | Server state caching, bg refetch | Adds dependency | Low |
| zustand | Simple global state | Doesn't cache server state well | Low |

**Recommendation: Local state + custom `useApi<T>` hook.** 3 pages, 1-2 endpoints each. No global state needed.

## Gap 6 - Styling: Tailwind vs CSS modules vs styled-components

| Approach | Pros | Cons | Complexity |
|----------|------|------|------------|
| Tailwind | Utility-first, fast prototyping, purged output | PostCSS config, class soup | Low |
| CSS Modules | Scoped CSS, no runtime | More files, manual responsive | Low |
| styled-components | CSS-in-JS, dynamic styles | Runtime overhead, larger bundle | Med |

**Recommendation: Tailwind CSS.** Fastest dashboard UI. Perfect for data layouts (cards, grids, tables).

## Gap 7 - API Client: fetch wrapper vs axios vs generated

| Approach | Pros | Cons | Complexity |
|----------|------|------|------------|
| fetch + typed wrapper | No deps, browser-native, ~30 lines | No interceptors | Low |
| axios | Interceptors, transforms | Adds ~13KB gzipped | Low |
| Generated (openapi-typescript) | Type-safe from spec | Requires OpenAPI spec, build step | Med |

**Recommendation: fetch + thin wrapper.** 3 endpoints, no need for axios complexity.

## Gap 8 - Testing: Vitest vs Jest

| Approach | Pros | Cons | Complexity |
|----------|------|------|------------|
| Vitest | Vite-native, fast, ESM, Jest-compatible API | Newer | Low |
| Jest | Battle-tested, in monorepo | Slower for Vite projects | Low |

**Recommendation: Vitest.** Vite-native = instant test runs. Jest API-compatible.

## Dashboard Pages

### Page 1: Overview
- Total events count (big number card)
- Events over time (line chart, daily from byDate)
- Events by agent (bar chart, from byAgent)
- Events by status (donut chart, from byStatus)

### Page 2: Events
- Filterable, paginated table
- Filters: agentName, status, date range
- Columns: timestamp, agent, skill, status, duration, tokens, cost
- Cursor-based pagination (load more)

### Page 3: Agent Detail
- Per-agent breakdown
- Token consumption over time
- Cost over time
- Skill usage per agent

## Slice Plan (3 chained PRs)

### Slice 1: Scaffold + Vite + routing + layout + Overview page

Files:
- `apps/dashboard/package.json` - React, Vite, Tailwind, react-router, recharts deps
- `apps/dashboard/vite.config.ts` - Vite config
- `apps/dashboard/index.html` - HTML entry
- `apps/dashboard/tailwind.config.js` - Tailwind config
- `apps/dashboard/postcss.config.js` - PostCSS config
- `apps/dashboard/tsconfig.json` - React-aware TS config
- `apps/dashboard/src/main.tsx` - React entry
- `apps/dashboard/src/App.tsx` - Router + layout
- `apps/dashboard/src/pages/Overview.tsx` - Stats overview with charts
- `apps/dashboard/src/components/Card.tsx` - Stat card
- `apps/dashboard/src/components/Chart.tsx` - Chart wrappers
- `apps/dashboard/src/hooks/useApi.ts` - Fetch wrapper hook
- `apps/dashboard/src/index.css` - Tailwind imports
- Root `package.json` - dashboard scripts (dev, build, preview)

Estimate: ~330 lines. Budget risk: Low.

### Slice 2: Events page + filters + pagination

Files:
- `apps/dashboard/src/pages/Events.tsx` - Paginated event table
- `apps/dashboard/src/components/EventTable.tsx` - Table component
- `apps/dashboard/src/components/FilterBar.tsx` - Filter controls
- `apps/dashboard/src/hooks/useEvents.ts` - Events fetch + pagination
- `apps/dashboard/src/types/api.ts` - API response types
- Tests for Events page

Estimate: ~330 lines. Budget risk: Low.

### Slice 3: Agent detail + polish + tests

Files:
- `apps/dashboard/src/pages/AgentDetail.tsx` - Per-agent view
- `apps/dashboard/src/hooks/useAgentStats.ts` - Agent-specific fetch
- Tests for Overview and AgentDetail
- README for dashboard setup

Estimate: ~280 lines. Budget risk: Low.

Forecast totals: ~940 changed lines across 3 slices. Overall budget risk: Low.

## Recommendation

Proceed to proposal with:
- React 18 + Vite (fast SPA build)
- recharts (declarative React charts)
- react-router v6 (URL-based navigation)
- Local state + custom fetch hook (no global state lib)
- Tailwind CSS (utility-first styling)
- fetch + typed wrapper (no axios, no codegen)
- Vitest (Vite-native testing)
- 3 pages: Overview, Events, Agent Detail
- 3-slice chained PRs: scaffold -> events -> agent detail + polish

## Risks

- **API endpoint coverage**: `/v1/stats/overview` only provides aggregate counts. For time-series (tokens/cost over time), need either additional API endpoints or client-side aggregation from paginated events. Mitigation: start with existing endpoints, add timeseries endpoint in C4 scope if needed.
- **UsageEvent data richness**: The event schema has nested JSONB fields (metrics, agent, skill) but the API returns them as raw JSON. The dashboard will need to parse/display these nested structures. Mitigation: types already available from `@agent-analytics/event-schema`.
- **Bundle size**: React + recharts + Tailwind = ~100KB gzipped. Acceptable for dev tool dashboard. Mitigation: Vite tree-shaking, Tailwind purging.
- **Dev experience**: Dashboard needs its own dev server pointing at the API. Mitigation: Vite proxy config for `/v1/*` to API server.

## Ready for Proposal

YES - run sdd-propose for change `analytics-dashboard` with the scope above.
