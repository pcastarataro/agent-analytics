# Design: Dashboard Bug Fixes and Evaluation Pages

## Technical Approach

Three-phase delivery: (1) fix EventTable columns and contentHash dedup bug, (2) add three aggregation endpoints to the API, (3) add three evaluation pages to the dashboard. All changes follow existing patterns — no new abstractions needed.

## Architecture Decisions

### Decision: contentHash fix strategy

**Choice**: Add `event.id` to the hash input in `generateContentHash`; change `onConflictDoNothing` target from `contentHash` to `id`
**Alternatives considered**: Keep contentHash as dedup key but include `id` in it; create a composite unique index
**Rationale**: The spec requires true idempotency by `event.id`. Using `ON CONFLICT (id) DO NOTHING` is idiomatic Postgres and eliminates the false-positive dedup of distinct events. contentHash remains useful for cache invalidation but no longer drives dedup.

### Decision: New aggregation endpoints reuse repository pattern

**Choice**: Add three methods to `EventRepository` interface + `createDrizzleRepository`, each returning a typed array. Routes in `stats.ts` delegate directly.
**Alternatives considered**: Single generic aggregation function; raw SQL outside repository
**Rationale**: Follows the existing `getMetricsAggregation` pattern exactly — each method owns its SQL, the route just calls it and returns JSON. Keeps the repository as the single data-access boundary.

### Decision: Dashboard pages use `useApi` hook

**Choice**: Each new page (Agents, Skills, Users) uses the existing `useApi<T>` hook with its endpoint URL, same as OverviewPage.
**Alternatives considered**: Custom fetch logic; shared state via context
**Rationale**: `useApi` already handles loading/error/refetch. Adding shared state would be over-engineering for pages that are read-only and independent.

## Data Flow

```
DB (usage_events)
  ↓  SQL aggregation (GROUP BY agent/version, skill/version, actor.userId)
Repository methods
  ↓  typed arrays
API routes (GET /v1/stats/*)
  ↓  JSON response
Dashboard pages (useApi hook)
  ↓  React state
SortableTable component (new, shared)
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `packages/database/src/repository.ts` | Modify | Fix `generateContentHash` to include `event.id`; change `insertBatch` to use `ON CONFLICT (id)`; add `getAgentStats`, `getSkillStats`, `getUserStats` methods |
| `packages/database/src/index.ts` | Modify | Export new types: `AgentStat`, `SkillStat`, `UserStat` |
| `apps/api/src/routes/stats.ts` | Modify | Add `GET /agents`, `GET /skills`, `GET /users` routes |
| `apps/dashboard/src/api/types.ts` | Modify | Add `AgentStat`, `SkillStat`, `UserStat` interfaces |
| `apps/dashboard/src/pages/EventsPage/EventTable.tsx` | Modify | Add Agent Version, Skill Version, Model columns |
| `apps/dashboard/src/components/Layout.tsx` | Modify | Add Agents, Skills, Users to `navItems` |
| `apps/dashboard/src/App.tsx` | Modify | Add `/agents`, `/skills`, `/users` routes |
| `apps/dashboard/src/pages/AgentsPage.tsx` | Create | Agent evaluation page |
| `apps/dashboard/src/pages/SkillsPage.tsx` | Create | Skill evaluation page |
| `apps/dashboard/src/pages/UsersPage.tsx` | Create | User evaluation page |
| `apps/dashboard/src/components/SortableTable.tsx` | Create | Shared sortable table component for evaluation pages |

## Interfaces / Contracts

New repository methods:

```typescript
interface AgentStat {
  agentName: string;
  version: string;
  executionCount: number;
  successRate: number;
  avgDurationMs: number;
  totalCost: number;
}

interface SkillStat {
  skillName: string;
  version: string;
  executionCount: number;
  successRate: number;
  totalCost: number;
}

interface UserStat {
  userId: string;
  eventCount: number;
  distinctAgents: number;
  distinctSkills: number;
  firstSeenAt: Date;
  lastSeenAt: Date;
}

// On EventRepository interface:
getAgentStats(filters?: DateFilters): Promise<AgentStat[]>;
getSkillStats(filters?: DateFilters): Promise<SkillStat[]>;
getUserStats(filters?: DateFilters): Promise<UserStat[]>;
```

API response shapes (all return `{ data: T[] }`):
- `GET /v1/stats/agents?from=&to=` → `{ data: AgentStat[] }`
- `GET /v1/stats/skills?from=&to=` → `{ data: SkillStat[] }`
- `GET /v1/stats/users?from=&to=` → `{ data: UserStat[] }`

## Bug Fix Approach

### Bug 1-3: Missing columns in EventTable

**Root cause**: EventTable renders `event.agent.name` but never reads `event.agent.version`, `event.skill.version`, or `event.model.name`. The data is already present in `UsageEventDTO` (types.ts line 65-68).

**Fix**: Add three `<td>` cells to EventTable after the Agent column. Each reads the nested field with `?? '—'"` fallback. No backend changes needed.

### Bug 4: Duplicate events from contentHash collision

**Root cause**: `generateContentHash` (repository.ts:120-132) hashes `traceId + parentId + eventType + agentName + toolName + skillName + status + timestamp` — but NOT `event.id`. Two distinct events with the same payload produce the same hash. `insertBatch` uses `ON CONFLICT (contentHash) DO NOTHING`, so the second event is silently dropped.

**Fix**:
1. Add `id: event.id` to the hash input in `generateContentHash`
2. Change `insertBatch` to `ON CONFLICT (id) DO NOTHING` — the primary key is the natural uniqueness constraint for events
3. Optionally add a one-time backfill migration to correct existing contentHash values (low priority — existing duplicates are already merged)

## Migration / Rollout

**contentHash fix**: Change is backward-compatible. Existing rows have stale contentHash values but since we're switching the conflict target to `id`, the old hash values become inert. No migration required.

**New columns in EventTable**: No migration — data already exists in the `agent` and `skill` jsonb columns.

**New API endpoints**: Purely additive — no existing endpoints change.

**New dashboard pages**: Purely additive — new routes, new files.

## Threat Matrix

N/A — no routing, shell, subprocess, VCS/PR automation, executable-file classification, or process-integration boundary.

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | `generateContentHash` includes `event.id` | Write test: two events with same payload but different IDs produce different hashes |
| Unit | `insertBatch` deduplicates by `id`, not contentHash | Write test: insert same event twice, verify only one row; insert two events with same payload but different IDs, verify both rows |
| Integration | `GET /v1/stats/agents` returns correct aggregation | Seed DB with test events, call endpoint, verify shape and values |
| Integration | `GET /v1/stats/skills` returns correct aggregation | Same pattern |
| Integration | `GET /v1/stats/users` returns correct aggregation including "unknown" fallback | Seed events with and without userId |
| E2E | EventTable shows agent version, skill version, model | Navigate to /events, assert columns exist and render correct values |
| E2E | Agents/Skills/Users pages render tables | Navigate to each route, verify table renders with data |
| E2E | Sortable columns work | Click column headers, verify re-sort |

## Open Questions

- [ ] Should the SortableTable component support client-side pagination, or is the existing load-more pattern sufficient for evaluation pages?
- [ ] Should the contentHash backfill migration be part of this change, or deferred to a follow-up?
