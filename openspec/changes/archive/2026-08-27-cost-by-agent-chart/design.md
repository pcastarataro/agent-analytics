# Design: Cost by Agent Chart

## Technical Approach

Replace the `EventsByStatus` donut chart on the Overview page with a `CostByAgent` horizontal bar chart. The new component fetches from `GET /v1/stats/agents` (returns `AgentStat[]`) and renders a recharts `BarChart` with `layout="vertical"`. The OverviewPage adds a second `useApi` call for agent stats alongside the existing overview fetch.

## Architecture Decisions

| Decision | Choice | Alternatives | Rationale |
|----------|--------|--------------|-----------|
| Chart type | Horizontal bar (`layout="vertical"`) | Vertical bar, donut, table | Horizontal bars better accommodate long agent names and align with the cost-comparison intent |
| Data source | Separate `useApi('/v1/stats/agents')` call | Merge into overview response | Keeps API unchanged; extra lightweight call is acceptable per proposal risk assessment |
| Cost format | `$${value.toFixed(4)}` | Intl.NumberFormat, `$0.00` | Matches existing pattern in `AgentsPage.tsx` and `SkillsPage.tsx` |
| Empty state | Inline "No cost data" message | Skeleton, redirect | Consistent with existing empty-state patterns in the codebase |

## Data Flow

```
OverviewPage
  ├─ useApi('/v1/stats/overview')  → data (existing)
  └─ useApi('/v1/stats/agents')    → agentsData (new)
                                        │
                                        ▼
                              CostByAgent ← AgentStat[]
                                        │
                                        ▼
                              BarChart layout="vertical"
                              YAxis: agentName
                              XAxis: totalCost ($X.XXXX)
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `apps/dashboard/src/pages/OverviewPage/CostByAgent.tsx` | Create | Horizontal bar chart component; accepts `AgentStat[]`, filters zero-cost, formats USD |
| `apps/dashboard/src/pages/OverviewPage.tsx` | Modify | Replace `EventsByStatus` import with `CostByAgent`; add `useApi` call for `/v1/stats/agents`; swap render |
| `apps/dashboard/src/pages/OverviewPage/EventsByStatus.tsx` | Delete | No longer referenced |

## Interfaces / Contracts

```typescript
// Existing type — no changes needed (api/types.ts)
interface AgentStat {
  agentName: string;
  version: string;
  executionCount: number;
  successRate: number;
  avgDurationMs: number;
  totalCost: number;
}

// New component props
interface CostByAgentProps {
  data: AgentStat[];
}
```

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | CostByAgent renders bars from AgentStat[] | Render with mock data, assert bar count and labels |
| Unit | Empty state when data is [] | Render with empty array, assert "No cost data" text |
| Unit | Zero-cost agents filtered out | Include agent with totalCost=0, assert not rendered |
| Integration | OverviewPage fetches and renders CostByAgent | Mock `/v1/stats/agents` endpoint, assert component appears |
| E2E | Overview page shows cost chart | Navigate to overview, verify chart visible at 768px+ |

## Threat Matrix

N/A — no routing, shell, subprocess, VCS/PR automation, executable-file classification, or process-integration boundary.

## Migration / Rollout

No migration required. The change is purely presentational — deleting one chart component and adding another. No data model changes, no feature flags needed.

## Open Questions

- [ ] Should agents with zero cost be filtered out or shown with a `$0.0000` label? (Proposal suggests filtering — design follows that.)
- [ ] Chart height: fixed at 240px (matching EventsByStatus) or dynamic based on agent count? (Design defaults to 240px for consistency; can revisit.)
