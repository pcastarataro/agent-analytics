# Tasks: Dashboard Fixes and Gantt Improvements

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 250–350 |
| 400-line budget risk | Low |
| Chained PRs recommended | Yes |
| Suggested split | PR1 → PR2 → PR3 → PR4 (stacked-to-main) |
| Delivery strategy | auto-chain |
| Chain strategy | stacked-to-main |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: Low

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|------|------|-----------|----------------------|-----------------|-------------------|
| 1 | EventTable model/version display fixes | PR1 | `npx tsc --noEventTable.tsx` | N/A — no test runner yet; visual verification on dashboard | Revert EventTable.tsx only |
| 2 | UserTable token/cost columns | PR2 | `npx tsc --noEmit` | GET /v1/stats/users returns token/cost fields | Revert repository.ts + UsersPage.tsx + types.ts |
| 3 | GanttChart colors, labels, sticky | PR3 | `npx tsc --noEmit` | Visual: tooltip color matches chart; sticky header during scroll | Revert eventColors.ts, GanttChart.tsx, GanttTooltip.tsx |
| 4 | Event dedup on contentHash | PR4 | `npx tsc --noEmit` | Insert same payload twice → only 1 row | Drop migration index + revert repository.ts onConflict target |

## Phase 1: EventTable Display Fixes (PR1 — low risk)

- [ ] 1.1 In `apps/dashboard/src/pages/EventsPage/EventTable.tsx`, change model column cell from `event.model.name` to `event.model?.id ?? '—'` (~5 lines)
- [ ] 1.2 In `apps/dashboard/src/pages/EventsPage/EventTable.tsx`, change agentVersion cell to `event.agent?.version ?? event.agent?.definitionHash ?? '—'` (~3 lines)
- [ ] 1.3 In `apps/dashboard/src/pages/EventsPage/EventTable.tsx`, change skillVersion cell to `event.skill?.version ?? '—'` (~2 lines)

## Phase 2: UserTable Token/Cost Columns (PR2 — medium risk)

- [x] 2.1 In `packages/database/src/repository.ts`, add 4 SUM aggregation columns to `getUserStats` query following `getMetricsAggregation` pattern (~12 lines)
- [x] 2.2 In `apps/dashboard/src/api/types.ts`, extend `UserStat` interface with `totalInputTokens`, `totalOutputTokens`, `totalCachedTokens`, `totalCost` fields (~6 lines)
- [x] 2.3 In `apps/dashboard/src/pages/UsersPage.tsx`, add inputTokens, outputTokens, cachedTokens, cost columns with number formatting (~30 lines)

## Phase 3: GanttChart Improvements (PR3 — medium risk)

- [ ] 3.1 Create `apps/dashboard/src/components/Gantt/eventColors.ts` exporting `EVENT_COLORS` constant with 6 event-type→color mappings (~12 lines)
- [ ] 3.2 In `apps/dashboard/src/components/Gantt/GanttTooltip.tsx`, replace local color map with import from `eventColors.ts` (~5 lines changed)
- [ ] 3.3 In `apps/dashboard/src/components/Gantt/GanttChart.tsx`, import shared `EVENT_COLORS`; replace inline color lookup (~8 lines changed)
- [ ] 3.4 In `apps/dashboard/src/components/Gantt/GanttChart.tsx`, enhance row label logic: `tool_call` → `event.tool?.name`, `skill_call` → `event.skill?.name`, others → event type (~15 lines)
- [ ] 3.5 In `apps/dashboard/src/components/Gantt/GanttChart.tsx`, restructure layout: wrap time-axis in sticky header div (`position: sticky; top: 0`), wrap event bars in scrollable middle div, wrap legend in sticky footer div (`position: sticky; bottom: 0`) (~25 lines)

## Phase 4: Event Dedup Fix (PR4 — medium risk)

- [ ] 4.1 In `packages/database/src/schema.ts`, change `index` to `uniqueIndex` on `contentHash` column (~1 line)
- [ ] 4.2 Create `packages/database/migrations/XXXX_add_content_hash_unique_index.ts` with up (drop non-unique, create unique) and down (reverse) (~15 lines)
- [ ] 4.3 In `packages/database/src/repository.ts`, change `onConflictDoNothing({ target: usageEvents.id })` to `onConflictDoNothing({ target: usageEvents.contentHash })` (~1 line)
- [ ] 4.4 Run migration against local DB; verify `INSERT ... ON CONFLICT (content_hash) DO NOTHING` works with same payload, different id (~manual verification)

## Phase 5: Verification

- [ ] 5.1 Run `npx tsc --noEventable` — zero type errors across all changed files
- [ ] 5.2 Visual check: EventTable shows `model.id` and `—` fallbacks correctly
- [ ] 5.3 Visual check: UserTable shows token/cost columns with formatted numbers
- [ ] 5.4 Visual check: GanttChart tooltip color matches bar color; row labels show tool/skill names
- [ ] 5.5 Visual check: GanttChart sticky header/footer visible during scroll on long sessions
- [ ] 5.6 Integration: insert duplicate contentHash → only 1 row; distinct IDs with different hashes → 2 rows
