# Tasks: Cost by Agent Chart

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~120 (40 new + 5 modified + 45 deleted + 30 tests) |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | Single PR |
| Delivery strategy | auto-chain |
| Chain strategy | size-exception |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: size-exception
400-line budget risk: Low

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|------|------|-----------|----------------------|-----------------|-------------------|
| 1 | Create CostByAgent, swap in OverviewPage, delete EventsByStatus, update tests | PR 1 | `pnpm --filter dashboard test` | Dev server overview page at `/` | Revert single commit restores EventsByStatus |

## Phase 1: Component Creation

- [x] 1.1 Create `apps/dashboard/src/pages/OverviewPage/CostByAgent.tsx` with horizontal `BarChart` (`layout="vertical"`), `YAxis` for `agentName`, `XAxis` for `totalCost` formatted as `$X.XXXX`, filters zero-cost agents, renders "No cost data" empty state when array is empty or all zero
- [x] 1.2 Export `CostByAgentProps` interface accepting `data: AgentStat[]`

## Phase 2: OverviewPage Integration

- [x] 2.1 In `apps/dashboard/src/pages/OverviewPage.tsx`: replace `EventsByStatus` import with `CostByAgent`, add `useApi<{ data: AgentStat[] }>('/v1/stats/agents')` call
- [x] 2.2 Swap `<EventsByStatus data={data.byStatus} />` with `<CostByAgent data={agentsData?.data ?? []} />` in the grid layout

## Phase 3: Cleanup

- [x] 3.1 Delete `apps/dashboard/src/pages/OverviewPage/EventsByStatus.tsx`
- [x] 3.2 Run `tsc --noEmit` to confirm no type errors remain

## Phase 4: Testing

- [x] 4.1 Update `apps/dashboard/__tests__/pages/OverviewPage.test.tsx`: mock second fetch for `/v1/stats/agents` returning `AgentStat[]`, replace `Events by Status` assertion with `Cost by Agent`
- [x] 4.2 Add unit test: CostByAgent renders bars from mock `AgentStat[]` data
- [x] 4.3 Add unit test: CostByAgent shows "No cost data" when data is empty array
- [x] 4.4 Add unit test: CostByAgent filters out agents with `totalCost: 0`
- [x] 4.5 Run `pnpm --filter dashboard test` and confirm all pass

## Phase 5: Verification

- [x] 5.1 Start dev server, navigate to `/`, verify horizontal bar chart renders with agent names and USD costs
- [x] 5.2 Verify no references to `EventsByStatus` remain in codebase (`grep -r EventsByStatus`)
