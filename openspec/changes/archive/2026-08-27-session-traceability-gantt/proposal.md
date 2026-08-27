# Proposal: Session Traceability & Gantt Visualization

## Intent

Agent workflows span multiple tool calls, assistant messages, and sub-sessions — but there's no way to reconstruct what happened during a session or understand timing relationships between events. This blocks debugging (which step failed?), performance analysis (which tool is slow?), and workflow understanding (what does a typical agent loop look like?). We need session-level traceability with a visual timeline.

## Scope

### In Scope
- Add `execution.eventType` to UsageEvent sub-schema (backward-compatible via looseObject)
- Collector sets `eventType` on all 5 emission points
- DB migration: `event_type` text column + composite index `(session_id, timestamp)`
- `GET /v1/sessions` — list sessions with event count, duration, agent name
- `GET /v1/sessions/:traceId` — ordered events for Gantt rendering
- `/sessions` dashboard page with session list table
- `/sessions/:id` dashboard page with custom SVG Gantt component

### Out of Scope
- Session replay (re-executing or viewing prompts/responses)
- Real-time streaming of live sessions
- Session comparison (side-by-side analysis)
- Export (PDF, CSV, share links)

## Capabilities

### New Capabilities
- `session-traceability`: Event type classification, session-level aggregation API, session list/detail views
- `session-gantt`: Custom SVG Gantt component for visualizing event timelines within a session

### Modified Capabilities
- `usage-event-schema`: New optional `execution.eventType` field (additive, non-breaking)
- `usage-collector`: Set `eventType` on each emission point
- `api-server`: New session query endpoints + DB column
- `dashboard-ui`: New session routes, pages, and Gantt component

## Approach

**Layer 1 — Schema**: Add `eventType` enum (`session_created | user_message | assistant_message | tool_call`) as optional in `execution` sub-schema. The existing `z.looseObject` guarantees backward compatibility — old events with undefined eventType treated as "unknown".

**Layer 2 — Collector**: Set `eventType` at each of the 5 emission points in `packages/opencode-collector`. Mapper table maps trigger → eventType.

**Layer 3 — DB**: Drizzle migration adds nullable `event_type` text column + composite index on `(session_id, timestamp)` for efficient session event queries.

**Layer 4 — API**: Two new endpoints. Session list aggregates by `session_id` (traceId). Session detail returns events ordered by timestamp.

**Layer 5 — Dashboard**: Sessions list page with sortable table. Session detail page with custom SVG Gantt: horizontal bars (color = event type), dots for zero-duration events, time axis with adaptive granularity, expandable sub-sessions via `execution.parentId`.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `packages/event-schema/src/execution.ts` | Modified | Add optional `eventType` to execution sub-schema |
| `packages/opencode-collector/src/mappers.ts` | Modified | Set `eventType` per emission point |
| `packages/database/src/schema.ts` | Modified | Add `eventType` column |
| `packages/database/migrations/` | New | Migration for `event_type` column + index |
| `apps/api/src/routes/sessions.ts` | New | Session list + detail endpoints |
| `apps/api/src/routes/index.ts` | Modified | Register session routes |
| `apps/dashboard/src/pages/Sessions.tsx` | New | Session list page |
| `apps/dashboard/src/pages/SessionDetail.tsx` | New | Session detail with Gantt |
| `apps/dashboard/src/components/SessionGantt.tsx` | New | Custom SVG Gantt component |
| `apps/dashboard/src/App.tsx` | Modified | Add session routes to router |
| `apps/dashboard/src/lib/api.ts` | Modified | Add session API functions |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Old events missing eventType create "unknown" gaps in Gantt | High | Accept as design choice; UI shows "unknown" row for pre-migration events |
| Large sessions with 1000+ events cause slow Gantt render | Low | Paginate session detail API; Gantt virtualizes off-screen rows |
| Composite index slows INSERT performance | Low | Text column + partial index; batch INSERT already handles load |

## Rollback Plan

1. Revert dashboard routes (new pages, no existing routes broken)
2. Remove session API endpoints (additive, no callers depend on them)
3. Drop `event_type` column (nullable, no data loss for other columns)
4. Remove `eventType` from collector mappers
5. Remove `eventType` from schema (optional field, old events unaffected)

## Dependencies

- Existing `execution.traceId` and `execution.parentId` fields (already in schema)
- Existing `metrics.durationMs` (already computed at source)
- Existing `timestamp` field (already set by collector)

## PR Strategy

**PR1 — Foundation** (~150 lines): Schema `eventType` addition + collector mapper changes + DB migration
**PR2 — Data Layer** (~120 lines): Session list + detail API endpoints + repository queries
**PR3 — UI** (~200 lines): Sessions page + SessionDetail page + SessionGantt component

## Success Criteria

- [ ] `eventType` is set on 100% of newly emitted events
- [ ] `GET /v1/sessions` returns aggregated session list with event count and duration
- [ ] `GET /v1/sessions/:traceId` returns events in chronological order
- [ ] Dashboard renders session list table with sortable columns
- [ ] Dashboard renders Gantt timeline with color-coded event bars
- [ ] Sub-sessions expandable via click in Gantt view
- [ ] All existing tests pass (zero regression)
