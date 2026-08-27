# Tasks: Dashboard Bug Fixes and Evaluation Pages

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 350–450 (across 3 PRs) |
| 400-line budget risk | Medium |
| Chained PRs recommended | Yes |
| Suggested split | PR1: ~100 lines → PR2: ~130 lines → PR3: ~200 lines |
| Delivery strategy | auto-chain |
| Chain strategy | stacked-to-main |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: Medium

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|------|------|-----------|----------------------|-----------------|-------------------|
| 1 | Fix EventTable columns + contentHash dedup | PR 1 | `npm test -- --filter database --filter dashboard` | N/A — unit tests only | EventTable.tsx, repository.ts changes only |
| 2 | Add aggregation endpoints (repo + API) | PR 2 | `npm test -- --filter database --filter api` | N/A — unit/integration tests | repository.ts new methods, stats.ts routes |
| 3 | Add evaluation pages + nav + SortableTable | PR 3 | `npm test -- --filter dashboard` | N/A — unit tests | New page files + Layout.tsx nav |

---

## Phase 1: Bug Fixes — EventTable Columns + Dedup

- [x] 1.1 **Add Agent Version, Skill Version, Model columns to EventTable** — In `apps/dashboard/src/pages/EventsPage/EventTable.tsx`, add three `<th>` headers after "Agent" and three `<td>` cells. Use `event.agent.version ?? '—'`, `event.skill?.version ?? '—'`, and `(event.model as Record<string,unknown>)?.name ?? '—'`. Follow existing cell styling. ~30 lines.

- [x] 1.2 **Fix contentHash to include event.id** — In `packages/database/src/repository.ts`, add `id: event.id` to the object passed to `JSON.stringify` in `generateContentHash`. ~1 line.

- [x] 1.3 **Change ON CONFLICT target from contentHash to id** — In `packages/database/src/repository.ts`, change `onConflictDoNothing({ target: usageEvents.contentHash })` to `onConflictDoNothing({ target: usageEvents.id })` in `insertBatch`. ~1 line.

- [x] 1.4 **RED test: contentHash includes event.id** — In `packages/database/src/__tests__/repository.test.ts`, add test: create two events with identical payloads but different IDs; assert `generateContentHash` returns different hashes. ~15 lines.

- [x] 1.5 **RED test: insertBatch deduplicates by id** — In `packages/database/src/__tests__/repository.test.ts`, add test: insert same event twice → only one row; insert two events with same payload, different IDs → both rows. ~20 lines.

- [x] 1.6 **Update EventTable test** — In `apps/dashboard/__tests__/components/EventTable.test.tsx`, add assertions for new columns (agent version, skill version, model) and fallback display. ~20 lines.

## Phase 2: API Aggregation Endpoints

- [x] 2.1 **Define AgentStat, SkillStat, UserStat interfaces in repository** — In `packages/database/src/repository.ts`, add interfaces: `AgentStat { agentName, version, executionCount, successRate, avgDurationMs, totalCost }`, `SkillStat { skillName, version, executionCount, successRate, totalCost }`, `UserStat { userId, eventCount, distinctAgents, distinctSkills, firstSeenAt, lastSeenAt }`. ~30 lines.

- [x] 2.2 **Implement getAgentStats method** — In `createDrizzleRepository`, add `getAgentStats(filters?)`. Query: `GROUP BY agent_name, coalesce(agent->>'version','unknown')`. Calculate `successRate = count(*) filter (where status='success') / count(*) * 100`. ~35 lines.

- [x] 2.3 **Implement getSkillStats method** — Same pattern. `GROUP BY skill->>'name', coalesce(skill->>'version','unknown')`. ~30 lines.

- [x] 2.4 **Implement getUserStats method** — `GROUP BY coalesce(actor->>'userId','unknown')`. Fields: eventCount, count(distinct agentName), count(distinct skill->>'name'), min(timestamp), max(timestamp). ~30 lines.

- [x] 2.5 **Add getAgentStats/getSkillStats/getSkillStats to EventRepository interface** — Add method signatures. ~6 lines.

- [x] 2.6 **Export new types from packages/database/src/index.ts** — Add `AgentStat`, `SkillStat`, `UserStat` to exports. ~3 lines.

- [x] 2.7 **Add API routes in apps/api/src/routes/stats.ts** — Add three `router.get(...)` handlers for `/agents`, `/skills`, `/users`. Each parses `from`/`to` query params, calls repository method, returns `{ data: [...] }`. ~30 lines.

- [x] 2.8 **RED test: getAgentStats groups by agent+version** — In `packages/database/src/__tests__/repository.test.ts`, seed events, call getAgentStats, assert correct grouping and successRate. ~20 lines.

- [x] 2.9 **RED test: getUserStats handles unknown userId** — Seed events with and without userId, assert "unknown" fallback row. ~15 lines.

- [x] 2.10 **RED test: stats routes return correct shape** — In `apps/api/src/__tests__/stats.test.ts`, add tests for each endpoint returning `{ data: [...] }`. ~20 lines.

## Phase 3: Dashboard Evaluation Pages

- [x] 3.1 **Add dashboard type interfaces** — In `apps/dashboard/src/api/types.ts`, add `AgentStat`, `SkillStat`, `UserStat` interfaces matching API response shapes. ~18 lines.

- [x] 3.2 **Create SortableTable component** — In `apps/dashboard/src/components/SortableTable.tsx`, build generic sortable table. Props: `columns: { key, label, render? }[]`, `data: T[]`, `defaultSortKey`, `defaultSortDir`. Use `useState` for sort. ~50 lines.

- [x] 3.3 **Create AgentsPage** — In `apps/dashboard/src/pages/AgentsPage.tsx`. Use `useApi<AgentStat[]>('/v1/stats/agents')`. Render SortableTable with columns: agentName, version, executionCount, successRate (%), avgDurationMs, totalCost ($). Default sort: executionCount desc. Handle empty state. ~30 lines.

- [x] 3.4 **Create SkillsPage** — In `apps/dashboard/src/pages/SkillsPage.tsx`. Same pattern. Columns: skillName, version, executionCount, successRate, totalCost. ~25 lines.

- [x] 3.5 **Create UsersPage** — In `apps/dashboard/src/pages/UsersPage.tsx`. Columns: userId, eventCount, distinctAgents, distinctSkills, firstSeenAt, lastSeenAt. Format timestamps with `toLocaleString()`. ~30 lines.

- [x] 3.6 **Add routes to App.tsx** — In `apps/dashboard/src/App.tsx`, import AgentsPage, SkillsPage, UsersPage. Add `<Route path="/agents" element={<AgentsPage />} />` etc. inside the Layout route. ~8 lines.

- [x] 3.7 **Add nav links to Layout.tsx** — In `apps/dashboard/src/components/Layout.tsx`, add `{ to: '/agents', label: 'Agents' }`, `{ to: '/skills', label: 'Skills' }`, `{ to: '/users', label: 'Users' }` to `navItems`. ~3 lines.

- [x] 3.8 **RED test: SortableTable sorts by column** — In `apps/dashboard/__tests__/components/SortableTable.test.tsx`, render with sample data, click header, assert sort order. ~20 lines.

- [x] 3.9 **RED test: AgentsPage renders table rows** — In `apps/dashboard/__tests__/pages/AgentsPage.test.tsx`, mock useApi, assert table renders rows. ~15 lines.

- [x] 3.10 **RED test: UsersPage handles empty state** — Mock useApi returning empty, assert "No users" message. ~10 lines.
