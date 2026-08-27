# Archive Report: Dashboard Fixes and Gantt Improvements

**Change**: dashboard-fixes-and-gantt-improvements
**Archived**: 2026-08-27
**Mode**: openspec
**Verdict**: PASS WITH WARNINGS

## Change Summary

Fixed eight data-display bugs and missing features across the dashboard: EventTable model/version column display, UserTable token/cost aggregation columns, GanttChart color unification + row labels + sticky layout, and event dedup on contentHash.

## What Was Accomplished

### 1. EventTable Display Fixes
- Model column reads `model.id` instead of `model.name` (which was undefined in mappers)
- Agent version falls back to `definitionHash` when `version` is absent
- Skill version already worked; added `—` fallback for consistency

### 2. UserTable Token/Cost Columns
- Added `SUM(inputTokens)`, `SUM(outputTokens)`, `SUM(cachedTokens)`, `SUM(cost)` aggregations to `getUserStats` query
- Extended `UserStat` interface with token/cost fields
- Added formatted number columns to UsersPage

### 3. GanttChart Improvements
- Extracted shared `EVENT_COLORS` constant (fixed color mismatch between chart and tooltip)
- Row labels now show tool name for `tool_call`, skill name for `skill_call`, event type for others
- Sticky time-axis header (`position: sticky; top: 0`) and legend footer (`position: sticky; bottom: 0`)

### 4. Event Dedup
- Added unique index on `content_hash` via Drizzle migration
- Changed `onConflictDoNothing` target from `id` to `contentHash`
- Collector retries with new UUID but same payload now correctly deduped

## Files Changed

| File | Action |
|------|--------|
| `apps/dashboard/src/pages/EventsPage/EventTable.tsx` | Modified — model.id display, version fallbacks |
| `apps/dashboard/src/pages/UsersPage.tsx` | Modified — token/cost columns |
| `apps/dashboard/src/api/types.ts` | Modified — UserStat extended with token/cost fields |
| `apps/dashboard/src/components/Gantt/eventColors.ts` | Created — shared EVENT_COLORS constant |
| `apps/dashboard/src/components/Gantt/GanttChart.tsx` | Modified — shared colors, row labels, sticky layout |
| `apps/dashboard/src/components/Gantt/GanttTooltip.tsx` | Modified — import shared colors |
| `packages/database/src/repository.ts` | Modified — SUM aggregations, onConflictDoNothing target |
| `packages/database/src/schema.ts` | Modified — uniqueIndex on contentHash |
| `packages/database/migrations/XXXX_add_content_hash_unique_index.ts` | Created — migration |
| `apps/api/src/__tests__/users.test.ts` | Modified — mock UserStat with token/cost fields |

## Commits (stacked-to-main)

1. `4b43e7a` — fix(dashboard): display model.id and provider in EventTable
2. `5f7acd8` — test(dashboard): update EventTable test for model.id display
3. `583fb33` — feat(db): add token/cost SUM aggregations to getUserStats query
4. `b2fcd2d` — feat(types): extend UserStat with token/cost fields
5. `18bd8c4` — test(api): update mock UserStat with token/cost fields
6. `b44bfeb` — feat(dashboard): add token/cost columns to UsersPage
7. (GanttChart commits — shared colors, labels, sticky layout)
8. (Dedup commits — unique index, onConflict target change)

## Test / Verification Results

- **TypeScript**: Clean across all 3 packages (0 errors)
- **Tests**: 68/68 passing (dashboard vitest)
- **Warnings**: 14 backend scenarios lack automated tests (no PostgreSQL in CI)

## Specs Synced

| Domain | Action | Details |
|--------|--------|---------|
| dashboard-ui | Updated | Events Page (model.id scenarios), User Evaluation (token/cost columns), Gantt Event Color Coding (shared EVENT_COLORS), added Gantt Row Labels with Context, added Gantt Sticky Header and Footer |
| api-server | Updated | User Stats (token/cost SUM aggregations), Batch Ingestion (ON CONFLICT contentHash), Database Schema (unique index), added Schema Migration for Content Hash Index |

## Task Reconciliation

Phase 1 tasks (1.1-1.3) and Phase 5 tasks (5.1-5.6) were unchecked in the persisted tasks.md at archive time. Orchestrator's final-state facts confirm completion:
- Phase 1 commits: `4b43e7a`, `5f7acd8` — EventTable model.id and test update
- Phase 5 verification: TypeScript clean (0 errors), 68/68 tests passing, visual checks confirmed

Stale checkboxes reconciled with proof from orchestrator's final-state facts. Reason recorded: "Orchestrator confirmed completion via explicit final-state facts and commit history; intermediate tasks.md snapshot was stale."

## Follow-Up Items

- **14 backend scenarios lack automated tests** — no PostgreSQL in CI environment; consider adding integration tests with testcontainers or a shared test database
- **Task tracker has 3 stale entries** — Phase 1 tasks were stale in the original tasks.md snapshot (reconciled at archive time)

## Source of Truth Updated

The following specs now reflect the new behavior:
- `openspec/specs/dashboard-ui/spec.md`
- `openspec/specs/api-server/spec.md`
