# Proposal: Cost by Agent Chart

## Intent

Replace the "Events by Status" donut chart on the Overview page with a "Cost by Agent" horizontal bar chart. The status breakdown provides limited insight on the overview — cost per agent is a more actionable metric for understanding spending distribution.

## Scope

### In Scope
- Replace `EventsByStatus` component with a new `CostByAgent` component
- Fetch `GET /v1/stats/agents` (already exists) instead of deriving from overview `byStatus`
- Render horizontal bar chart using recharts `BarChart` with `layout="vertical"`
- Show agent name (y-axis) and `totalCost` (x-axis) formatted as USD
- Handle empty state (no agents / zero cost)

### Out of Scope
- No API changes — `GET /v1/stats/agents` already returns `totalCost` per agent
- No changes to the Agents page (`/agents` table stays as-is)
- No changes to `EventsByStatus.tsx` itself — it will be removed, not modified
- No new recharts dependencies — already installed

## Capabilities

### New Capabilities
None — this modifies an existing capability.

### Modified Capabilities
- `dashboard-ui`: The Overview Page requirement changes — replace the status donut chart with a cost-per-agent bar chart. The `GET /v1/stats/agents` endpoint is already specified; no delta spec needed for `api-server`.

## Approach

1. Create `CostByAgent.tsx` in `apps/dashboard/src/pages/OverviewPage/` using recharts horizontal `BarChart`
2. Accept `AgentStat[]` as prop (from `GET /v1/stats/agents`)
3. Format cost as `$X.XXXX` using existing pattern from `AgentsPage`
4. Update `OverviewPage.tsx` to:
   - Replace `EventsByStatus` import with `CostByAgent`
   - Add `useApi<{ data: AgentStat[] }>` call for `/v1/stats/agents`
   - Swap the `<EventsByStatus>` render with `<CostByAgent data={agentsData?.data ?? []} />`
5. Delete `EventsByStatus.tsx`

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `apps/dashboard/src/pages/OverviewPage/CostByAgent.tsx` | New | New horizontal bar chart component |
| `apps/dashboard/src/pages/OverviewPage.tsx` | Modified | Swap import, add agent stats fetch, render new component |
| `apps/dashboard/src/pages/OverviewPage/EventsByStatus.tsx` | Removed | No longer used |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Extra API call on overview page | Low | `/v1/stats/agents` is lightweight; could cache or merge later |
| Agents with zero cost display oddly | Low | Filter out zero-cost agents or show "—" |

## Rollback Plan

Restore `EventsByStatus.tsx` from git, revert `OverviewPage.tsx` imports and render to original state.

## Dependencies

- `GET /v1/stats/agents` endpoint (already exists and typed as `AgentStat[]`)
- recharts library (already installed)

## Success Criteria

- [ ] Overview page renders "Cost by Agent" horizontal bar chart
- [ ] Each bar shows agent name and cost in USD format
- [ ] Empty state shows "No cost data" or similar message
- [ ] No references to `EventsByStatus` remain in the codebase
- [ ] `tsc --noEmit` passes with no errors
- [ ] Chart renders correctly at 768px+ viewport width
