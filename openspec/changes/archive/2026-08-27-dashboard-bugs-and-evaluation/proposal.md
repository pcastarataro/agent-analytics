# Proposal: Dashboard Bug Fixes and Evaluation Pages

## Intent

The events table hides critical metadata (agent version, skill version, model) despite the schema supporting it. A dedup bug causes phantom duplicate rows. Users have no way to evaluate agent/skill performance across versions or see per-user usage. This change fixes the data-display bugs and adds three evaluation views.

## Scope

### In Scope
1. **Bug: agent version not shown** — add `agent.version` column to EventTable
2. **Bug: skill version not shown** — add `skill.version` column to EventTable
3. **Bug: model not shown** — add `model` column to EventTable (display `model.name` or fallback)
4. **Bug: duplicate events** — investigate contentHash collision (missing event.id in hash); fix dedup key
5. **Agent Evaluation page** — `/agents` route: agent list with per-version execution count, success rate, avg duration, total cost
6. **Skill Evaluation page** — `/skills` route: skill list with per-version execution count, success rate, cost
7. **User Evaluation page** — `/users` route: skills/agents per user, general usage metrics
8. **API endpoints** — `GET /v1/stats/agents`, `GET /v1/stats/skills`, `GET /v1/stats/users` for aggregation data

### Out of Scope
- Collector-side changes to populate agent.version / skill.version (separate effort)
- Real-time streaming or live updates
- Export/download functionality
- Mobile-responsive overhaul

## Capabilities

### Modified Capabilities
- `dashboard-ui`: add 3 new pages (AgentEval, SkillEval, UserEval), update EventTable columns, add nav links
- `api-server`: add 3 aggregation endpoints, fix dedup logic if contentHash is root cause

### New Capabilities
- `user-evaluation`: user-level aggregation of skills, agents, and usage metrics

## Approach

**Bug fixes (Phase 1)**: Fix EventTable to display version/model columns. Fix contentHash to include event.id for true uniqueness. Low risk, small diff.

**API aggregation (Phase 2)**: Add `GET /v1/stats/agents`, `GET /v1/stats/skills`, `GET /v1/stats/users` using existing repository patterns. Reuse `MetricsAggregation` interface patterns already in repository.ts.

**Dashboard pages (Phase 3)**: Add three pages following existing OverviewPage patterns (StatsCard + tables). Add nav links in Layout.tsx.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `apps/dashboard/src/pages/EventsPage/EventTable.tsx` | Modified | Add agent version, skill version, model columns |
| `apps/dashboard/src/pages/AgentsPage.tsx` | New | Agent evaluation view |
| `apps/dashboard/src/pages/SkillsPage.tsx` | New | Skill evaluation view |
| `apps/dashboard/src/pages/UsersPage.tsx` | New | User evaluation view |
| `apps/dashboard/src/App.tsx` | Modified | Add routes |
| `apps/dashboard/src/components/Layout.tsx` | Modified | Add nav links |
| `packages/database/src/repository.ts` | Modified | Fix dedup, add aggregation queries |
| `packages/api/src/routes/stats.ts` (or equivalent) | Modified | Add 3 endpoints |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| contentHash fix may require data migration for existing duplicates | Low | Backfill existing rows with corrected hashes |
| Aggregation queries may be slow on large datasets | Medium | Add indexes on (agentName, timestamp), (skill fields) if needed |
| User evaluation requires actor.userId to be populated | Medium | Verify collector sets OPENCODE_ANALYTICS_USER; fallback to "unknown" |

## Rollback Plan

- **Bug fixes**: Revert EventTable changes; no data migration needed
- **New pages/routes**: Remove files and nav links; no data side effects
- **New API endpoints**: Remove route registrations; no DB changes required
- **Dedup fix**: If contentHash migration causes issues, drop the new index and revert to old hash logic

## Dependencies

- Existing `EvolutionMetrics` interface already aggregates by agent/skill version — reuse for AgentEval/SkillEval pages
- `actor.userId` field must be reliably populated by collectors for UserEval to be meaningful

## Success Criteria

- [ ] Event table shows agent version, skill version, and model columns
- [ ] No duplicate events appear in table after contentHash fix
- [ ] Agent Evaluation page lists all agents with version breakdowns and performance metrics
- [ ] Skill Evaluation page lists all skills with version breakdowns and cost metrics
- [ ] User Evaluation page shows per-user skill/agent usage summary
- [ ] All new endpoints return correct aggregation data matching repository queries
- [ ] All existing tests continue to pass
