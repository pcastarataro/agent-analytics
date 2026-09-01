# Design: Project & Branch Analytics

## Technical Approach

Hybrid JSONB + generated columns. The existing `project` JSONB column stores `{name, branch}` at event creation time. Two generated text columns (`project_name`, `project_branch`) extract these values at insert time for B-tree indexing. The collector populates `project.name` from `path.basename(directory)` and `project.branch` from `git rev-parse --abbrev-ref HEAD`. New API endpoints aggregate by these columns. Dashboard adds Projects and Branches pages following existing patterns.

## Architecture Decisions

### Decision: Generated columns vs JSONB indexing

| Option | Tradeoff | Decision |
|--------|----------|----------|
| GIN index on JSONB | Flexible but slower range scans, no partial index support | Rejected |
| Generated columns + B-tree | Fixed schema but O(1) lookup, exact same perf as `agent_name` column | **Chosen** |
| Separate `project_name`/`project_branch` columns | Manual duplication, sync risk | Rejected |

**Rationale**: Follows the exact pattern used for `agent_name` — a denormalized text column extracted from JSONB for fast indexing. PostgreSQL 16 supports stored generated columns. Drizzle 0.39 supports the `generatedAlwaysAs` DSL.

### Decision: Git command execution strategy

| Option | Tradeoff | Decision |
|--------|----------|----------|
| Synchronous `execSync` | Blocks event emission, simple | Rejected |
| Async `execFile` with timeout | Non-blocking, fails gracefully | **Chosen** |
| Child process pool | Overkill for single command | Rejected |

**Rationale**: Collector hooks are synchronous callbacks — we must not block. Use `child_process.execFile` with 2s timeout and cache result per directory within session scope.

### Decision: Branch caching scope

| Option | Tradeoff | Decision |
|--------|----------|----------|
| Per-session Map | Short-lived, safe, no stale data | **Choned** |
| Global LRU cache | Risk of stale branches across worktrees | Rejected |
| No caching | Repeated git calls per event | Rejected |

**Rationale**: Branch is per-directory within a session. A simple `Map<string, string>` in the plugin closure (same scope as `executions` map) suffices and auto-clears on session idle.

## Data Flow

```
OpenCode Hook                    Collector                        API                      DB
     │                              │                               │                        │
     │  session.created             │                               │                        │
     │  (directory, worktree)  ────►│ extract project.name           │                        │
     │                              │ git rev-parse → branch         │                        │
     │                              │ cache in Map<dir, branch>      │                        │
     │  message.updated        ────►│ merge into project: {}         │                        │
     │  tool.execute.before   ────►│ enqueueEvent(project: {...})   │                        │
     │  tool.execute.after    ────►│ buffer.flush() ──────────────►│ POST /v1/events/batch  │
     │                              │                               │ repository.insertBatch()│
     │                              │                               │ INSERT → generated cols │
     │                              │                               │ compute project_name,   │
     │                              │                               │ project_branch at write │
     │                              │                               │                        │
     │                              │         Dashboard ◄──────────►│ GET /v1/stats/projects  │
     │                              │                               │ SELECT ... GROUP BY     │
     │                              │                               │ project_name (B-tree)   │
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `packages/event-schema/src/schemas.ts` | Modify | Extend `projectSchema` with `name` and `branch` fields |
| `packages/opencode-collector/src/index.ts` | Modify | Extract project.name/branch from directory, cache branch |
| `packages/database/src/schema.ts` | Modify | Add generated columns + indexes |
| `packages/database/src/repository.ts` | Modify | Add `ProjectStat`, `BranchStat`, `ProjectDetail`, `BranchDetail` interfaces and query methods |
| `packages/database/migrations/0005_add_project_branch_columns.sql` | Create | DDL for generated columns and indexes |
| `apps/api/src/routes/stats.ts` | Modify | Add `/projects`, `/projects/:name`, `/branches`, `/branches/:name` routes |
| `apps/dashboard/src/api/types.ts` | Modify | Add DTOs for project/branch stats and detail |
| `apps/dashboard/src/pages/ProjectsPage.tsx` | Create | Sortable table of project metrics |
| `apps/dashboard/src/pages/ProjectDetailPage.tsx` | Create | Project detail with stats cards + recent events |
| `apps/dashboard/src/pages/BranchesPage.tsx` | Create | Sortable table of branch metrics |
| `apps/dashboard/src/pages/BranchDetailPage.tsx` | Create | Branch detail with stats cards + recent events |
| `apps/dashboard/src/App.tsx` | Modify | Add routes for projects/branches |
| `apps/dashboard/src/components/Layout.tsx` | Modify | Add Projects and Branches to navItems |

## Database Design

### DDL (Migration 0005)

```sql
-- 0005_add_project_branch_columns.sql
ALTER TABLE "usage_events"
  ADD COLUMN IF NOT EXISTS "project_name" text
    GENERATED ALWAYS AS (project->>'name') STORED;
ALTER TABLE "usage_events"
  ADD COLUMN IF NOT EXISTS "project_branch" text
    GENERATED ALWAYS AS (project->>'branch') STORED;
CREATE INDEX IF NOT EXISTS "idx_project_name" ON "usage_events" ("project_name");
CREATE INDEX IF NOT EXISTS "idx_project_branch" ON "usage_events" ("project_branch");
```

### Drizzle Schema Addition

```typescript
// packages/database/src/schema.ts — additions to usageEvents
projectName: text('project_name').generatedAlwaysAs(sql`project->>'name'`),
projectBranch: text('project_branch').generatedAlwaysAs(sql`project->>'branch'`),
// + indexes: idx_project_name, idx_project_branch
```

### Schema Spec Update

```typescript
// packages/event-schema/src/schemas.ts
export const projectSchema = z.looseObject({
  name: z.string().optional(),
  branch: z.string().optional(),
});
```

## Collector Design

### Project Name Extraction

```typescript
// packages/opencode-collector/src/index.ts
import { basename } from 'node:path';

// Inside createPlugin, capture directory at startup
const projectName = basename(directory) || 'unknown';
```

### Branch Detection (Async, Cached)

```typescript
import { execFile } from 'node:child_process';

const branchCache = new Map<string, string>();

async function detectBranch(workDir: string): Promise<string> {
  const cached = branchCache.get(workDir);
  if (cached !== undefined) return cached;

  return new Promise((resolve) => {
    execFile('git', ['rev-parse', '--abbrev-ref', 'HEAD'], {
      cwd: workDir,
      timeout: 2000,
      encoding: 'utf-8',
    }, (err, stdout) => {
      const branch = err ? 'detached' : (stdout ?? 'detached').trim();
      branchCache.set(workDir, branch);
      resolve(branch);
    });
  });
}
```

### Integration in enqueueEvent

```typescript
// Merge project fields into every event
const branch = await detectBranch(directory);
enqueueEvent({
  project: { name: projectName, branch },
  // ... existing fields
});
```

### Error Handling
- `git` not found → fallback to "detached" (logged once)
- `git` timeout (2s) → fallback to "detached"
- Non-git directory → fallback to "detached"
- `directory` empty/missing → project.name defaults to "unknown"

## API Design

### New Interfaces (repository.ts)

```typescript
export interface ProjectStat {
  projectName: string;
  eventCount: number;
  distinctBranches: number;
  distinctAgents: number;
  totalCost: number;
  avgCost: number;
  successRate: number;
}

export interface BranchStat {
  branch: string;
  eventCount: number;
  distinctProjects: number;
  distinctAgents: number;
  totalCost: number;
  avgCost: number;
  successRate: number;
}

export interface ProjectDetail {
  projectName: string;
  totalEvents: number;
  successRate: number;
  avgCost: number;
  totalCost: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  distinctBranches: number;
  byBranch: Array<{ branch: string; count: number; totalCost: number }>;
  byAgent: Array<{ name: string; count: number; totalCost: number }>;
  eventsOverTime: Array<{ date: string; count: number }>;
  recentEvents: UsageEvent[];
}

export interface BranchDetail {
  branch: string;
  totalEvents: number;
  successRate: number;
  avgCost: number;
  totalCost: number;
  distinctProjects: number;
  byProject: Array<{ project: string; count: number; totalCost: number }>;
  byAgent: Array<{ name: string; count: number; totalCost: number }>;
  eventsOverTime: Array<{ date: string; count: number }>;
  recentEvents: UsageEvent[];
}
```

### Route Structure (stats.ts)

| Route | Handler | Query |
|-------|---------|-------|
| `GET /v1/stats/projects` | `getProjectStats(filters?)` | `SELECT project_name, count(*), ... GROUP BY project_name` |
| `GET /v1/stats/projects/:name` | `getProjectDetail(name)` | Aggregation + recent events for one project |
| `GET /v1/stats/branches` | `getBranchStats(filters?)` | `SELECT project_branch, count(*), ... GROUP BY project_branch` |
| `GET /v1/stats/branches/:name` | `getBranchDetail(name)` | Aggregation + recent events for one branch |

### Query Pattern (repository.ts)

```typescript
// Example: getProjectStats — follows existing getAgentStats pattern
async getProjectStats(filters?: DateFilters): Promise<ProjectStat[]> {
  const rows = await db
    .select({
      projectName: usageEvents.projectName,
      eventCount: sql<number>`count(*)::int`,
      distinctBranches: sql<number>`count(distinct ${usageEvents.projectBranch})::int`,
      distinctAgents: sql<number>`count(distinct ${usageEvents.agentName})::int`,
      totalCost: sql<number>`coalesce(sum(...), 0)::numeric`,
      avgCost: sql<number>`coalesce(avg(...), 0)::numeric`,
      successRate: sql<number>`coalesce(count(*) filter (where status='success') * 100.0 / count(*), 0)`,
    })
    .from(usageEvents)
    .where(whereClause ?? undefined)
    .groupBy(usageEvents.projectName)
    .orderBy(sql`count(*) desc`);
  // ... map to ProjectStat[]
}
```

### Performance Notes

- B-tree indexes on `project_name` and `project_branch` enable O(log n) lookups
- Generated columns are computed at INSERT time — no per-query JSONB extraction
- `GROUP BY project_name` uses index-only scan when possible
- Detail endpoints limit `recentEvents` to 20 rows (same as agent/skill detail)

## Dashboard Design

### Component Hierarchy

```
Layout
├── NavItem: "Projects" → /projects
├── NavItem: "Branches" → /branches
│
ProjectsPage
├── SortableTable<ProjectStatRow>
│   └── Column: projectName (Link → /projects/:name)
│   └── Column: eventCount (sortable)
│   └── Column: distinctBranches (sortable)
│   └── Column: totalCost (sortable)
│   └── Column: successRate (sortable)
│
ProjectDetailPage
├── Breadcrumb: ← Projects
├── StatsCards: totalEvents, successRate, avgCost, totalCost, tokens
├── BarChart: byBranch
├── BarChart: byAgent
├── LineChart: eventsOverTime
└── RecentEventsTable (same pattern as AgentDetailPage)

BranchesPage / BranchDetailPage — mirror pattern
```

### API Integration

Dashboard DTOs mirror repository interfaces. `useApi<ProjectStat[]>('/v1/stats/projects')` follows existing hook pattern.

### State Management

No new state management needed. Each page is self-contained with `useApi` hook — same pattern as `AgentsPage`.

## Error Handling Strategy

| Layer | Error | Response |
|-------|-------|----------|
| Collector | git command fails | Log warn, use "detached", continue |
| Collector | directory missing | Use "unknown", continue |
| Database | migration fails | Migration halts, no partial state |
| API | query error | `next(err)` → error handler middleware → 500 JSON |
| API | project/branch not found | 404 `{ error: "Project not found" }` |
| Dashboard | API fetch fails | `ErrorMessage` component with retry |
| Dashboard | empty data | `SortableTable` shows "No projects found." |

## Migration / Rollout

- **No backfill**: Existing events keep `project: {}` → generated columns produce `NULL`
- **NULL handling**: Aggregation queries filter NULLs (excluded from stats, or grouped as "unknown")
- **Idempotent**: `IF NOT EXISTS` on columns and indexes — safe to re-run
- **Down migration**: `DROP COLUMN IF EXISTS project_name, project_branch` + `DROP INDEX IF EXISTS`

## Open Questions

- [ ] Should projects page show events with `NULL` project_name as "unknown" or exclude them entirely?
- [ ] Should branch detail show a cost-by-date chart (like SkillDetailPage) or just events-over-time?
- [ ] Is 2s timeout for `git rev-parse` appropriate for large monorepos?
