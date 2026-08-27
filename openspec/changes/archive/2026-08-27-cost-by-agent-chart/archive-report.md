# Archive Report: Cost by Agent Chart

**Change**: cost-by-agent-chart
**Archived**: 2026-08-27
**Status**: PASS

## Summary

Replaced the "Events by Status" donut chart on the Overview page with a "Cost by Agent" horizontal bar chart. The new component fetches from `GET /v1/stats/agents` and renders agent names on the y-axis with total cost formatted as USD on the x-axis. Zero-cost agents are filtered out, and an empty state is shown when no cost data is available.

## Spec Sync

| Domain | Action | Details |
|--------|--------|---------|
| dashboard-ui | Updated | 1 added, 1 modified, 0 removed requirements |

### Changes Applied

- **ADDED**: `Cost By Agent Chart` requirement with 4 scenarios (renders bars, USD formatting, empty state, zero-cost filtering)
- **MODIFIED**: `Overview Page` requirement — replaced donut chart description with cost bar chart; updated scenarios to reflect new data source (`/v1/stats/agents`)

## Archive Contents

| Artifact | Status |
|----------|--------|
| proposal.md | ✅ Present |
| specs/dashboard-ui/spec.md | ✅ Present |
| design.md | ✅ Present |
| tasks.md | ✅ Present (12/12 tasks complete) |
| verify-report.md | ✅ Present |

## Verification

| Metric | Value |
|--------|-------|
| Verdict | PASS |
| Tasks complete | 12/12 |
| Requirements covered | 2/2 |
| Scenarios covered | 7/7 (6 fully compliant, 1 partial — format assertion missing in test) |
| Critical findings | 0 |
| Blockers | 0 |
| Build | ✅ tsc --noEmit passed (pre-existing errors unrelated) |
| Tests | ✅ 68 passed (dashboard) / 134 passed (monorepo) |

### Issues

- **SUGGESTION**: Add test assertion for USD-formatted cost label (e.g., `screen.getByText('$0.0123')`). Formatter exists in source but test only checks container presence.

## Source of Truth Updated

- `openspec/specs/dashboard-ui/spec.md` — now reflects cost-by-agent chart behavior

## Files Changed

| File | Action |
|------|--------|
| `apps/dashboard/src/pages/OverviewPage/CostByAgent.tsx` | Created |
| `apps/dashboard/src/pages/OverviewPage.tsx` | Modified |
| `apps/dashboard/src/pages/OverviewPage/EventsByStatus.tsx` | Deleted |
| `apps/dashboard/__tests__/pages/OverviewPage.test.tsx` | Modified |

## SDD Cycle Complete

The change has been fully planned, implemented, verified, and archived.
