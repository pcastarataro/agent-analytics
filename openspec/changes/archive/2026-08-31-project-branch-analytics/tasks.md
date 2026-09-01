# Tasks: Project & Branch Analytics

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 750–900 |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 → PR 2 → PR 3 → PR 4 |
| Delivery strategy | ask-on-risk |
| Chain strategy | pending |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: pending
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|------|------|-----------|----------------------|-----------------|-------------------|
| 1 | Schema + migration + event schema + collector | PR 1 (~65 lines) | `pnpm -r test --filter event-schema --filter opencode-collector` | Emit event with project fields via collector smoke test | Revert schema, event-schema, collector changes independently |
| 2 | Repository interfaces + query methods + API routes | PR 2 (~230 lines) | `pnpm -r test --filter database --filter api` | `curl GET /v1/stats/projects` against local DB | Revert repository + routes; DB migration stays |
| 3 | Dashboard types + list pages + nav + routing | PR 3 (~210 lines) | `pnpm -r test --filter dashboard` | Navigate to /projects and /branches in browser | Revert dashboard pages, nav, routing; types stay |
| 4 | Dashboard detail pages | PR 4 (~300 lines) | `pnpm -r test --filter dashboard` | Navigate to /projects/:name and /branches/:name | Revert detail pages only |

## Phase 1: Foundation (Schema + Collector)

- [x] 1.1 Add `projectName` and `projectBranch` generated columns + B-tree indexes to `packages/database/src/schema.ts` using `generatedAlwaysAs(sql\`project->>'name'\`)`
- [x] 1.2 Create `packages/database/migrations/0005_add_project_branch_columns.sql` with ALTER TABLE + CREATE INDEX (idempotent, `IF NOT EXISTS`)
- [x] 1.3 Extend `projectSchema` in `packages/event-schema/src/schemas.ts` with `name: z.string().optional()` and `branch: z.string().optional()`
- [x] 1.4 Add `ProjectStat`, `BranchStat`, `ProjectDetail`, `BranchDetail` interfaces to `packages/database/src/repository.ts`
- [x] 1.5 Test: `packages/event-schema/src/__tests__/schemas.test.ts` — projectSchema accepts `{name, branch}`, rejects non-string values
- [x] 1.6 Test: `packages/database/src/__tests__/repository.test.ts` — verify new interfaces compile (type-level test)

## Phase 2: Collector (Project Extraction)

- [x] 2.1 Add `import { basename } from 'node:path'` and `import { execFile } from 'node:child_process'` to `packages/opencode-collector/src/index.ts`
- [x] 2.2 Create `branchCache = new Map<string, string>()` and `detectBranch(workDir)` async function with 2s timeout, "detached" fallback
- [x] 2.3 Extract `projectName = basename(directory) || 'unknown'` in `createPlugin` closure, merge `project: { name: projectName, branch }` into every event
- [x] 2.4 Test: `packages/opencode-collector/src/__tests__/smoke.test.ts` — event includes `project.name` from directory basename, `project.branch` from git mock
- [x] 2.5 Test: collector — git failure returns "detached", empty directory returns "unknown"

## Phase 3: Repository Queries

- [x] 3.1 Implement `getProjectStats(filters?)` in `packages/database/src/repository.ts` — GROUP BY `project_name`, compute eventCount, distinctBranches, distinctAgents, totalCost, avgCost, successRate
- [x] 3.2 Implement `getProjectDetail(name)` — aggregation + byBranch + byAgent + eventsOverTime + recentEvents (limit 20)
- [x] 3.3 Implement `getBranchStats(filters?)` — GROUP BY `project_branch`, same metrics pattern
- [x] 3.4 Implement `getBranchDetail(name)` — aggregation + byProject + byAgent + eventsOverTime + costByDate + recentEvents
- [x] 3.5 Add `getProjectStats`, `getProjectDetail`, `getBranchStats`, `getBranchDetail` to `EventRepository` interface
- [x] 3.6 Test: `packages/database/src/__tests__/repository.test.ts` — each method returns correct shape, NULL project_name grouped as "unknown"

## Phase 4: API Routes

- [x] 4.1 Add `GET /v1/stats/projects` route to `apps/api/src/routes/stats.ts` — parse dateFilters, call `repository.getProjectStats(filters)`
- [x] 4.2 Add `GET /v1/stats/projects/:name` route — call `getProjectDetail(name)`, 404 if null
- [x] 4.3 Add `GET /v1/stats/branches` route — parse dateFilters, call `repository.getBranchStats(filters)`
- [x] 4.4 Add `GET /v1/stats/branches/:name` route — call `getBranchDetail(name)`, 404 if null
- [x] 4.5 Test: `apps/api/src/__tests__/stats.test.ts` — each endpoint returns 200 with correct shape, 404 for nonexistent name

## Phase 5: Dashboard Types + Navigation

- [x] 5.1 Add `ProjectStat`, `BranchStat`, `ProjectDetail`, `BranchDetail` DTOs to `apps/dashboard/src/api/types.ts` — mirror repository interfaces
- [x] 5.2 Add `{ to: '/projects', label: 'Projects' }` and `{ to: '/branches', label: 'Branches' }` to `navItems` in `apps/dashboard/src/components/Layout.tsx`
- [x] 5.3 Add routes in `apps/dashboard/src/App.tsx`: `/projects`, `/projects/:name`, `/branches`, `/branches/:name`

## Phase 6: Dashboard Pages

- [x] 6.1 Create `apps/dashboard/src/pages/ProjectsPage.tsx` — SortableTable with columns: projectName (link), eventCount, distinctBranches, totalCost, successRate
- [x] 6.2 Create `apps/dashboard/src/pages/ProjectDetailPage.tsx` — breadcrumb, StatsCards (totalEvents, successRate, avgCost, totalCost, tokens), BarChart byBranch, BarChart byAgent, LineChart eventsOverTime, RecentEventsTable
- [x] 6.3 Create `apps/dashboard/src/pages/BranchesPage.tsx` — SortableTable with columns: branch (link), eventCount, distinctProjects, totalCost, successRate
- [x] 6.4 Create `apps/dashboard/src/pages/BranchDetailPage.tsx` — breadcrumb, StatsCards, BarChart byProject, BarChart byAgent, LineChart eventsOverTime, costByDate chart, RecentEventsTable
- [x] 6.5 Test: `apps/dashboard/__tests__/pages/ProjectsPage.test.tsx` — renders table, handles empty state
- [x] 6.6 Test: `apps/dashboard/__tests__/pages/ProjectDetailPage.test.tsx` — renders stats cards, charts, recent events
- [x] 6.7 Test: `apps/dashboard/__tests__/pages/BranchDetailPage.test.tsx` — renders stats cards, cost-by-date chart

## Phase 7: Integration Verification

- [x] 7.1 Run `pnpm -r test` — all existing + new tests pass
- [x] 7.2 Run `pnpm -r build` — no TypeScript errors across monorepo
- [x] 7.3 Manual: emit event via collector, verify `project_name` and `project_branch` populated in DB
- [x] 7.4 Manual: `GET /v1/stats/projects` returns data, dashboard renders Projects page
