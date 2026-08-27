# Design: Dashboard Fixes and Gantt Improvements

## Technical Approach

Four parallel workstreams: (1) EventTable column read fixes and version fallbacks, (2) UserTable SUM aggregation + new columns, (3) GanttChart color unification + row labels + sticky layout, (4) Event dedup index migration + onConflictDoNothing target change. All changes are backwards-compatible — no data migration needed for items 1-3; item 4 is an additive index.

## Architecture Decisions

### Decision: Model display — use `model.id`, not `model.provider + model.id`

| Option | Tradeoff | Decision |
|--------|----------|----------|
| `model.id` alone | Clean, matches how mappers populate it | ✅ Chosen |
| `model.provider + " / " + model.id` | More info but verbose for table cell | Rejected — tooltip can show full detail |
| `model.name` (current) | Undefined — mappers never write it | Rejected — root cause of the bug |

**Rationale**: `mapAssistantMessage` writes `{ provider, id }` — there is no `name` field. Showing `model.id` directly resolves the display bug with zero mapper changes.

### Decision: Content hash dedup — target `contentHash` column, not `id`

| Option | Tradeoff | Decision |
|--------|----------|----------|
| `ON CONFLICT (id)` (current) | Fails on collector retry with new UUID | Rejected |
| `ON CONFLICT (content_hash)` | Deduped by payload, not UUID | ✅ Chosen |
| `ON CONFLICT (content_hash, id)` | Over-constrained, same semantics as single col | Rejected — `id` is already part of the hash input |

**Rationale**: `generateContentHash` includes `event.id` in the hash input (line 151 of repository.ts), so distinct events with different IDs produce different hashes. This satisfies the spec requirement that distinct events are not collapsed.

### Decision: Gantt sticky layout — CSS `position: sticky` on wrapper divs

| Option | Tradeoff | Decision |
|--------|----------|----------|
| CSS `position: sticky` | Native, no JS, degrades to static | ✅ Chosen |
| JS-based fixed positioning | More control, more complexity | Rejected |
| Separate SVG elements per section | Breaks time-axis alignment | Rejected |

**Rationale**: `position: sticky` is well-supported and provides exactly the behavior needed — time axis sticks to top, legend sticks to bottom, event area scrolls independently.

## Data Flow

```
┌─ EventTable ─────────────────────────────────┐
│  reads model.id (not model.name)              │
│  reads agent.version ?? agent.definitionHash ?? '—'  │
│  reads skill.version ?? '—'                   │
└───────────────────────────────────────────────┘
         ↕ (no data flow change)

┌─ UserTable ───────────────────────────────────┐
│  GET /v1/stats/users                          │
│    → getUserStats() adds SUM aggregations     │
│    → returns inputTokens, outputTokens,       │
│      cachedTokens, cost per user              │
└───────────────────────────────────────────────┘

┌─ GanttChart ──────────────────────────────────┐
│  imports EVENT_COLORS from shared constant    │
│  row labels: tool.name / skill.name / type    │
│  layout: sticky header + scrollable + sticky  │
│  footer                                       │
└───────────────────────────────────────────────┘

┌─ Batch Ingestion ─────────────────────────────┐
│  insertBatch() → ON CONFLICT (content_hash)   │
│  schema: unique index on content_hash         │
└───────────────────────────────────────────────┘
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `apps/dashboard/src/pages/EventsPage/EventTable.tsx` | Modify | Change `model.name` → `model.id`; add `agent.definitionHash` fallback |
| `apps/dashboard/src/pages/UsersPage.tsx` | Modify | Add inputTokens, outputTokens, cachedTokens, cost columns |
| `apps/dashboard/src/api/types.ts` | Modify | Add token/cost fields to `UserStat` interface |
| `apps/dashboard/src/components/Gantt/eventColors.ts` | Create | Shared `EVENT_COLORS` constant |
| `apps/dashboard/src/components/Gantt/GanttChart.tsx` | Modify | Import shared colors; restructure layout for sticky header/footer; enhance row labels |
| `apps/dashboard/src/components/Gantt/GanttTooltip.tsx` | Modify | Import shared colors instead of local map |
| `packages/database/src/repository.ts` | Modify | Add SUM aggregations to `getUserStats`; change `onConflictDoNothing` target to `contentHash` |
| `packages/database/src/schema.ts` | Modify | Change `index` → `uniqueIndex` on `contentHash` |
| `packages/database/migrations/XXXX_add_content_hash_unique_index.ts` | Create | Migration: drop existing idx_content_hash, create unique content_hash index |

## Interfaces / Contracts

### UserStat (extended)

```typescript
export interface UserStat {
  userId: string;
  eventCount: number;
  distinctAgents: number;
  distinctSkills: number;
  totalInputTokens: number;   // NEW
  totalOutputTokens: number;  // NEW
  totalCachedTokens: number;  // NEW
  totalCost: number;          // NEW
  firstSeenAt: Date;
  lastSeenAt: Date;
}
```

### EVENT_COLORS (shared constant)

```typescript
// apps/dashboard/src/components/Gantt/eventColors.ts
export const EVENT_COLORS: Record<string, string> = {
  session_created: '#3B82F6',  // blue
  user_message: '#10B981',     // green
  assistant_message: '#8B5CF6', // purple
  tool_call: '#F59E0B',        // amber
  skill_call: '#14B8A6',       // teal
  unknown: '#6B7280',          // gray
};
```

### getUserStats query additions

```typescript
// Added to the select clause, following getMetricsAggregation pattern (lines 372-394)
totalInputTokens: sql<number>`coalesce(sum((${usageEvents.metrics}::jsonb->>'inputTokens')::bigint), 0)::bigint`,
totalOutputTokens: sql<number>`coalesce(sum((${usageEvents.metrics}::jsonb->>'outputTokens')::bigint), 0)::bigint`,
totalCachedTokens: sql<number>`coalesce(sum((${usageEvents.metrics}::jsonb->>'cachedTokens')::bigint), 0)::bigint`,
totalCost: sql<number>`coalesce(sum((${usageEvents.metrics}::jsonb->>'cost')::numeric), 0)::numeric`,
```

## Migration Strategy

### Phase 1-3: No migration needed
EventTable, UserTable, and GanttChart changes are pure frontend — no database changes.

### Phase 4: Content hash unique index

Migration file: `packages/database/migrations/XXXX_add_content_hash_unique_index.ts`

```typescript
// Up: Drop non-unique index, create unique index
// Down: Drop unique index, recreate non-unique index
import { sql } from 'drizzle-orm';

export async function up(db: any) {
  await db.execute(sql`DROP INDEX IF EXISTS idx_content_hash`);
  await db.execute(sql`CREATE UNIQUE INDEX idx_content_hash ON usage_events (content_hash)`);
}

export async function down(db: any) {
  await db.execute(sql`DROP INDEX IF EXISTS idx_content_hash`);
  await db.execute(sql`CREATE INDEX idx_content_hash ON usage_events (content_hash)`);
}
```

**Ordering**: Migration runs first, then `insertBatch` change. Safe because:
- Existing rows have unique content hashes (id is part of hash input)
- `ON CONFLICT` handles the transition gracefully
- Rollback: drop index, revert onConflictDoNothing target

## Threat Matrix

N/A — no routing, shell, subprocess, VCS/PR automation, executable-file classification, or process-integration boundary.

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | EventTable renders `model.id` correctly | Render with mock UsageEventDTO having `model: { provider: 'openai', id: 'gpt-4' }` — assert cell shows "gpt-4" |
| Unit | EventTable version fallbacks | Render with undefined version fields — assert `—` shown |
| Unit | UserTable shows token/cost columns | Render with UserStat including token fields — assert columns present |
| Unit | GanttChart uses shared colors | Import EVENT_COLORS, render tooltip for `tool_call` — assert color matches chart |
| Unit | GanttChart row labels show tool name | Render with `tool_call` event having `tool.name: 'bash'` — assert label shows "bash" |
| Unit | Gantt sticky layout has correct CSS | Assert header has `position: sticky; top: 0` |
| Unit | `getUserStats` returns SUM fields | Mock db.select, assert totalInputTokens etc. in result |
| Integration | Batch dedup on content_hash | Insert event, insert same content hash with different id — assert only 1 row |
| E2E | User stats page shows token totals | Navigate to `/users`, assert inputTokens column visible with values |

## Migration / Rollout

No phased rollout needed — all changes are backwards-compatible. Deploy order:
1. Run migration (creates unique index)
2. Deploy backend (new getUserStats query, new onConflictDoNothing target)
3. Deploy frontend (new columns, fixed model display, new Gantt features)

Rollback: Revert frontend first, then backend, then drop migration index.

## Open Questions

- [ ] Should `agent.version` fallback to `agent.definitionHash` when version is absent? (proposal suggests this, but definitionHash is a different concept — a content fingerprint, not a semantic version)
- [ ] Should Gantt row labels truncate long tool names with ellipsis? (spec says "must not overflow" — need to decide max width)
- [ ] Should the GanttChart sticky layout use `overflow-y: auto` on the middle section, or let the parent container scroll? (affects nested scroll behavior)
