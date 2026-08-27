# Design: analytics-dashboard

## Technical Approach

React 18 + Vite SPA replacing the empty `apps/dashboard/` stub. Uses local state (`useState` + custom hooks), recharts for visualization, react-router v6 for navigation, and Tailwind CSS. Typed `fetch` wrapper consumes the existing API — no new backend work. Three PR slices under 400 lines each.

## Architecture Decisions

| Decision | Options | Tradeoff | Choice | Rationale |
|----------|---------|----------|--------|-----------|
| UI framework | React 18 vs Vue 3 vs Svelte | React has largest ecosystem; proposal specifies it | React 18 | Aligned with proposal; team familiarity |
| Build tool | Vite vs CRA vs esbuild | Vite fastest cold start; CRA deprecated; esbuild needs config | Vite | Standard for React+TS; proxy support built-in |
| Charts | recharts vs Chart.js vs D3 | recharts = declarative React; Chart.js = imperative; D3 = low-level | recharts | Declarative components match React patterns |
| Routing | react-router v6 vs tanstack-router | react-router mature; tanstack-router newer, stricter types | react-router v6 | Proposal specifies it; lower adoption risk |
| State | useState + hooks vs Zustand vs Redux | Local state = zero deps; Zustand = minimal; Redux = heavy | Local state | 3 views, no shared mutable state; proposal-aligned |
| HTTP client | fetch wrapper vs axios vs ky | fetch = native; axios = ~13KB; ky = ~3KB | fetch wrapper (~30 lines) | Zero deps; typed via generic; proposal-aligned |
| Test runner | Vitest vs Jest | Vitest = Vite-native; Jest = existing monorepo runner | Vitest | Vite-native, ESM-first, no config needed with Vite |
| Styling | Tailwind vs CSS modules vs styled-components | Tailwind = utility-first; CSS modules = scoped; styled = runtime | Tailwind | Proposal specifies it; desktop-first suits utility classes |

## Data Flow

```
┌─────────────┐     fetch      ┌──────────────┐     HTTP/JSON    ┌───────────┐
│  React Page  │ ──────────→   │  useApi hook  │ ──────────────→  │  API       │
│  (component) │ ←──────────   │  (typed)      │ ←──────────────  │  /v1/*     │
│              │   useState    │               │    response      │  (proxy)   │
└──────┬───────┘               └──────────────┘                   └───────────┘
       │
       ▼
┌──────────────┐
│  recharts    │  ← declarative props (data arrays from API)
│  components  │
└──────────────┘
```

## Module Topology

```
apps/dashboard/
├── index.html
├── package.json
├── vite.config.ts
├── tailwind.config.ts
├── postcss.config.js
├── tsconfig.json                    ← rewrite (Vite extends)
├── src/
│   ├── main.tsx                     ← React root mount
│   ├── App.tsx                      ← Router + Layout
│   ├── index.css                    ← Tailwind directives
│   ├── api/
│   │   ├── client.ts               ← fetchApi<T> generic wrapper
│   │   └── types.ts                ← API response types (derived from UsageEvent)
│   ├── hooks/
│   │   └── useApi.ts               ← useApi<T>(url) → { data, loading, error, refetch }
│   ├── components/
│   │   ├── Layout.tsx              ← sidebar nav + main content area
│   │   ├── ErrorBoundary.tsx       ← React error boundary
│   │   ├── LoadingSpinner.tsx      ← shared loading indicator
│   │   └── ErrorMessage.tsx        ← error display + retry button
│   └── pages/
│       ├── OverviewPage.tsx        ← StatsCard + 3 charts
│       │   ├── StatsCard.tsx       ← total events count card
│       │   ├── EventsByAgent.tsx   ← recharts BarChart
│       │   ├── EventsByStatus.tsx  ← recharts PieChart (donut)
│       │   └── EventsOverTime.tsx  ← recharts LineChart
│       ├── EventsPage.tsx          ← FilterBar + EventTable + Load More
│       │   ├── FilterBar.tsx       ← agent/status filter controls
│       │   └── EventTable.tsx      ← paginated event table
│       └── AgentDetailPage.tsx     ← per-agent breakdown charts
├── __tests__/
│   ├── api/
│   │   └── client.test.ts
│   ├── hooks/
│   │   └── useApi.test.tsx
│   └── pages/
│       ├── OverviewPage.test.tsx
│       └── AgentDetailPage.test.tsx
```

## Component Tree (Mermaid)

```mermaid
graph TD
    App["App<br/>(BrowserRouter)"]
    App --> Layout["Layout<br/>(Sidebar + Outlet)"]
    Layout --> Overview["OverviewPage<br/>/"]
    Layout --> Events["EventsPage<br/>/events"]
    Layout --> AgentDetail["AgentDetailPage<br/>/agents/:name"]

    Overview --> StatsCard["StatsCard<br/>totalEvents count"]
    Overview --> LineChart["EventsOverTime<br/>recharts LineChart"]
    Overview --> BarChart["EventsByAgent<br/>recharts BarChart"]
    Overview --> DonutChart["EventsByStatus<br/>recharts PieChart"]

    Events --> FilterBar["FilterBar<br/>agent/status select"]
    Events --> EventTable["EventTable<br/>sorted rows + Load More"]

    AgentDetail --> AgentBarChart["recharts BarChart<br/>tokens per agent"]
    AgentDetail --> AgentLineChart["recharts LineChart<br/>events over time"]

    Layout -.-> ErrorBoundary["ErrorBoundary<br/>(catches render errors)"]
    Layout -.-> LoadingSpinner["LoadingSpinner"]
    Layout -.→ ErrorMessage["ErrorMessage<br/>+ Retry"]
```

## API Client Design

**`src/api/client.ts`** — ~30 lines:

```typescript
export async function fetchApi<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, init);
  if (!res.ok) {
    throw new Error(`API ${res.status}: ${res.statusText}`);
  }
  return res.json() as Promise<T>;
}
```

**`src/api/types.ts`** — response shapes derived from existing schemas:

```typescript
export interface StatsOverview {
  total: number;
  byAgent: Record<string, number>;
  byStatus: Record<string, number>;
  byDate: Record<string, number>;  // "YYYY-MM-DD" → count
}

export interface UsageEventDTO {
  id: string;
  agent: { name: string; version?: string };
  execution: { traceId: string; parentId?: string };
  metrics: { durationMs?: number; inputTokens?: number; outputTokens?: number; cost?: number };
  result: { status: 'success' | 'error' | 'cancelled' };
  skill: { name: string };
  timestamp?: string;  // from DB column, not in UsageEvent Zod schema
}

export interface PaginatedEvents {
  data: UsageEventDTO[];
  nextCursor: string | null;
}

export interface EventFilters {
  agentName?: string;
  status?: string;
  limit?: number;
  cursor?: string;
}
```

## Chart Component Design

| Page | Chart | recharts Component | Data Source | Props Shape |
|------|-------|--------------------|-------------|-------------|
| Overview | Events by Agent | `<BarChart>` + `<Bar>` | `byAgent` Record → `[{name, count}]` | `{data: {name: string, count: number}[]}` |
| Overview | Events by Status | `<PieChart>` + `<Pie>` | `byStatus` Record → `[{name, value}]` | `{data: {name: string, value: number}[]}` |
| Overview | Events Over Time | `<LineChart>` + `<Line>` | `byDate` Record → `[{date, count}]` | `{data: {date: string, count: number}[]}` |
| Agent Detail | Tokens per Agent | `<BarChart>` + `<Bar>` | Filtered events grouped by agent | `{data: {agent, tokens}[]}` |

All recharts components use `<ResponsiveContainer>` for fluid sizing. Record→array transforms happen in the page component (pure function, easy to test).

## Vite Config

```typescript
// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/v1': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
});
```

Tailwind: `@tailwindcss/vite` plugin in Vite config (Tailwind v4 style) or PostCSS plugin. PostCSS fallback:

```javascript
// postcss.config.js
export default { plugins: { tailwindcss: {}, autoprefixer: {} } };
```

```css
/* src/index.css */
@tailwind base;
@tailwind components;
@tailwind utilities;
```

## Slice Plan (PR dependency order)

| Slice | PR Scope | Files | ~Lines | Dependencies |
|-------|----------|-------|--------|--------------|
| **1** | Scaffold + Overview | `vite.config.ts`, `postcss.config.js`, `tailwind.config.ts`, `index.html`, `src/main.tsx`, `src/index.css`, `src/App.tsx`, `src/api/client.ts`, `src/api/types.ts`, `src/hooks/useApi.ts`, `src/components/Layout.tsx`, `src/components/LoadingSpinner.tsx`, `src/components/ErrorMessage.tsx`, `src/components/ErrorBoundary.tsx`, `src/pages/OverviewPage.tsx` + 4 chart children, `package.json`, `tsconfig.json` | ~330 | None (first) |
| **2** | Events page | `src/pages/EventsPage.tsx`, `src/components/FilterBar.tsx`, `src/components/EventTable.tsx`, react-router route addition in `App.tsx` | ~330 | Slice 1 (types, hooks, layout) |
| **3** | Agent Detail + Tests | `src/pages/AgentDetailPage.tsx`, route in `App.tsx`, `__tests__/` unit tests, `README.md` | ~280 | Slice 1, 2 (all components exist) |

Each slice is independently mergeable — Slice 2 only adds routes/components, Slice 3 adds a page + tests.

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | `fetchApi` error handling, Record→array transform functions | Vitest + mock fetch |
| Component | `useApi` hook loading/error/data states | React Testing Library + MSW or mock fetch |
| Page | OverviewPage renders charts from mock data; EventsPage pagination | Vitest + render with mocked API |
| Integration | Route navigation between Overview/Events/AgentDetail | React Testing Library MemoryRouter |

Vitest config inherits from `vite.config.ts`. No separate vitest.config needed.

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `apps/dashboard/package.json` | Rewrite | Add React, Vite, Tailwind, recharts, react-router, vitest deps |
| `apps/dashboard/tsconfig.json` | Rewrite | Vite-appropriate TS config with JSX |
| `apps/dashboard/vite.config.ts` | Create | Vite + React plugin + API proxy |
| `apps/dashboard/tailwind.config.ts` | Create | Tailwind content paths |
| `apps/dashboard/postcss.config.js` | Create | PostCSS Tailwind plugin |
| `apps/dashboard/index.html` | Create | Vite entry HTML |
| `apps/dashboard/src/main.tsx` | Create | React root mount |
| `apps/dashboard/src/index.css` | Create | Tailwind directives |
| `apps/dashboard/src/App.tsx` | Create | Router + Layout wrapper |
| `apps/dashboard/src/api/client.ts` | Create | Typed fetch wrapper |
| `apps/dashboard/src/api/types.ts` | Create | API response type definitions |
| `apps/dashboard/src/hooks/useApi.ts` | Create | Data-fetching hook |
| `apps/dashboard/src/components/*.tsx` | Create | Layout, ErrorBoundary, LoadingSpinner, ErrorMessage |
| `apps/dashboard/src/pages/*.tsx` | Create | OverviewPage, EventsPage, AgentDetailPage + chart children |
| `apps/dashboard/src/__tests__/**/*.tsx` | Create | Vitest unit/component tests |
| `apps/dashboard/src/index.ts` | Delete | Replaced by React entry point |

## Threat Matrix

N/A — no routing, shell, subprocess, VCS/PR automation, executable-file classification, or process-integration boundary. The Vite dev proxy is a standard development-only configuration, not a routing boundary.

## Migration / Rollout

No migration required. The dashboard is a new SPA with no existing data to migrate. The `apps/dashboard/src/index.ts` stub is deleted and replaced — it exported only a package name constant with no consumers.

## Open Questions

- [ ] Should Agent Detail page link from the Overview bar chart (click agent → detail), or only via direct URL?
- [ ] API returns `byDate` as `Record<string, number>` — is this sufficient for the LineChart or do we need date-range filtering on the frontend?
