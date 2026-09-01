# Proposal: Project & Branch Analytics Dashboards

## Intent

The `usage_events` table has a `project` JSONB column populated as `{}` — unused. No `branch` field exists. Users need analytics for agent/skill utilization segmented by project and branch, but today's stats endpoints (`getAgentStats`, `getSkillStats`, `getUserStats`) provide no project/branch dimension. The collector already receives `directory` and `worktree` from OpenCode but discards them.

## Scope

### In Scope

- Extend `projectSchema` in event-schema with `name` (basename of directory) and `branch` (git HEAD ref)
- Update collector to extract `project.name` from `directory` and `project.branch` via `git rev-parse --abbrev-ref HEAD`
- Add `project_name` and `project_branch` generated columns + indexes to `usage_events`
- New API endpoints: `GET /v1/stats/projects`, `GET /v1/stats/projects/:name`, `GET /v1/stats/branches`, `GET /v1/stats/branches/:name`
- New API endpoints: `GET /v1/stats/projects/:name/agents`, `GET /v1/stats/projects/:name/skills`, `GET /v1/stats/branches/:name/agents`, `GET /v1/stats/branches/:name/skills`
- Dashboard: Projects page (`/projects`), Branches page (`/branches`), detail sub-views
- Navigation updates for new pages

### Out of Scope

- Backfilling historical events with project/branch data
- Cross-project or cross-branch comparison dashboards (future)
- Real-time branch detection (branch is captured at event time, not updated)
- Project-level permission or access control

## Capabilities

### New Capabilities

- `project-branch-schema`: Extended project schema with name/branch fields, collector extraction logic
- `project-branch-stats`: API endpoints for project/branch aggregated metrics
- `project-branch-dashboard`: Dashboard pages for project and branch analytics

### Modified Capabilities

- `usage-event-schema`: `projectSchema` gains `name` and `branch` fields (additive, backward-compatible via `z.looseObject`)
- `api-server`: New aggregation endpoints, schema migration for generated columns
- `dashboard-ui`: New navigation routes and page components
- `usage-collector`: Extract project/branch from `directory`/`worktree` parameters

## Approach

Hybrid approach: JSONB storage for the `project` field (flexible schema) with generated columns (`project_name`, `project_branch`) for fast indexed queries. The collector derives `project.name` from `path.basename(directory)` and `project.branch` from `git rev-parse --abbrev-ref HEAD` at event creation time. New stats endpoints aggregate by `(agentName, version)` scoped to project/branch filters. Dashboard adds Projects and Branches pages with sortable tables linking to detail sub-views.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `packages/event-schema/src/schemas.ts` | Modified | Extend `projectSchema` with `name`, `branch` |
| `packages/opencode-collector/src/index.ts` | Modified | Extract project/branch from `directory` param |
| `packages/database/src/schema.ts` | Modified | Add generated columns + indexes |
| `packages/database/src/repository.ts` | Modified | New aggregation query methods |
| `apps/api/src/routes/` | New | Stats routes for projects/branches |
| `apps/dashboard/src/pages/` | New | Projects, Branches pages |
| `apps/dashboard/src/App.tsx` | Modified | New routes |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| `git rev-parse` slow in large repos | Low | Run async, cache per session, non-blocking |
| Generated columns break existing queries | Low | Additive only; existing columns unchanged |
| Collector directory resolution differs across OS | Medium | Use `path.basename()` which is OS-agnostic |
| Pre-existing events have null project_name/branch | Low | NULL handled in aggregation (excluded or grouped as "unknown") |

## Rollback Plan

1. Drop generated columns `project_name` and `project_branch` via down migration
2. Revert `projectSchema` to `z.looseObject({})` (old events remain valid)
3. Revert collector changes — `project: {}` restored as default
4. Remove new API routes and dashboard pages
5. No data loss — JSONB `project` column retains whatever was stored

## Dependencies

- PostgreSQL 16 (generated columns supported)
- Drizzle ORM 0.39 (supports generated columns)
- Git binary available in collector runtime environment

## Success Criteria

- [ ] Events emitted with `project.name` and `project.branch` populated
- [ ] `GET /v1/stats/projects` returns per-project agent/skill aggregates
- [ ] `GET /v1/stats/branches` returns per-branch agent/skill aggregates
- [ ] Dashboard Projects page shows sortable table with project metrics
- [ ] Dashboard Branches page shows sortable table with branch metrics
- [ ] Existing tests pass; new tests cover project/branch extraction and aggregation
