# Proposal: Dashboard Fixes and Gantt Improvements

## Intent

Eight data-display bugs and missing features degrade the dashboard's usefulness: EventTable hides model/version columns because mappers write different fields than the table reads; UserTable lacks token/cost columns; GanttChart has duplicate color maps, unintelligible row labels, and no sticky header/footer; and event dedup only keys on UUID, letting collector retries create phantom duplicates.

## Scope

### In Scope
1. Fix EventTable to read `model.id` instead of `model.name`; show `—` when absent
2. Fix EventTable skill/agent version columns — populate where available, `—` fallback
3. Add token/cost total columns to UserTable (SUM aggregation, no averages)
4. Unify GanttChart + GanttTooltip color maps into single shared constant
5. Improve Gantt row labels to include tool/skill/model context
6. Add sticky time-axis header and sticky legend footer to GanttChart
7. Add unique index on `content_hash`; use `onConflictDoNothing` keyed on contentHash

### Out of Scope
- Collector-side changes to auto-populate version fields (separate effort)
- Real-time streaming, export/download, mobile overhaul
- GanttChart zoom/pan or interactive filtering

## Capabilities

### New Capabilities
None.

### Modified Capabilities
- `dashboard-ui`: EventTable column reads (`model.id` not `model.name`), UserTable token/cost columns, GanttChart color unification + row labels + sticky layout
- `api-server`: User stats aggregation adds SUM for tokens/cost; batch ingestion dedup changes from `ON CONFLICT (id)` to `ON CONFLICT (content_hash)`

## Approach

**Phase 1 — EventTable fixes**: Update column reads in `EventTable.tsx` to use `model.id`; add `—` fallbacks for version fields.

**Phase 2 — UserTable tokens**: Add `SUM(inputTokens)`, `SUM(outputTokens)`, `SUM(cachedTokens)`, `SUM(cost)` to `getUserStats` query (same pattern as `getMetricsAggregation`). Add columns to `UserTable.tsx`.

**Phase 3 — GanttChart**: Extract `EVENT_COLORS` to shared constant; prefix row labels with tool/skill/model; wrap overflow content in sticky header/footer containers.

**Phase 4 — Dedup**: Add unique index migration on `content_hash`; change `insertBatch` to use `onConflictDoNothing({ target: usageEvents.contentHash })`.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `apps/dashboard/src/pages/EventsPage/EventTable.tsx` | Modified | Fix model read path, version fallbacks |
| `apps/dashboard/src/pages/UsersPage.tsx` | Modified | Add token/cost columns |
| `apps/dashboard/src/components/GanttChart.tsx` | Modified | Shared colors, row labels, sticky layout |
| `apps/dashboard/src/components/GanttTooltip.tsx` | Modified | Use shared EVENT_COLORS |
| `packages/database/src/repository.ts` | Modified | User stats SUM aggregations |
| `packages/database/src/schema.ts` | Modified | Unique index on content_hash |
| `packages/database/src/repository.ts` | Modified | onConflictDoNothing target change |
| `packages/database/migrations/` | New | Migration for content_hash unique index |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| contentHash dedup changes existing insert behavior | Medium | Migration is additive (new index only); existing id-based dedup remains as fallback during rollout |
| SUM aggregations slow on large datasets | Low | Existing indexes on (agentName, timestamp) cover query patterns |
| Gantt sticky layout breaks on older browsers | Low | Use `position: sticky` with fallback static layout |

## Rollback Plan

- **EventTable/UserTable**: Revert component changes; no data migration
- **GanttChart**: Revert component changes; no data side effects
- **Dedup index**: Drop the unique index migration; revert `onConflictDoNothing` target to `id`
- **User stats aggregation**: Remove SUM columns from query; revert UI columns

## Dependencies

- Existing `getUserStats` query pattern in repository.ts
- Existing `getMetricsAggregation` SUM pattern as reference
- Drizzle migration tooling for content_hash index

## Success Criteria

- [ ] EventTable shows `model.id` (not empty) when model data is present
- [ ] EventTable shows skill/agent version or `—` — never blank
- [ ] UserTable displays total input/output/cache tokens and cost per user
- [ ] GanttChart uses single shared color map — tooltip matches chart colors
- [ ] Gantt row labels identify individual tool_call/skill_call events
- [ ] GanttChart time axis stays visible when scrolling vertically
- [ ] Collector retries with new UUID but same payload produce no duplicate rows
- [ ] All existing tests pass; no regressions in batch ingestion
