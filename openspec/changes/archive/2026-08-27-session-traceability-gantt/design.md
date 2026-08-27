# Design: Session Traceability & Gantt Visualization

## Technical Approach

Extend the existing usage event pipeline with `eventType` classification at the collector layer, persist it as a denormalized DB column for fast filtering, expose session aggregation via two new API endpoints, and render a custom SVG Gantt in the dashboard. The design follows existing patterns: Zod schemas for validation, Drizzle ORM for DB, Express routes, and React with `useApi` hook.

## Architecture Decisions

| Decision | Choice | Alternatives | Rationale |
|----------|--------|--------------|-----------|
| eventType storage | Denormalized `event_type` text column | JSONB extraction; separate table | Fast filtering without JSONB overhead; matches existing `agent_name`, `session_id` pattern |
| Session aggregation | SQL GROUP BY in repository | In-memory aggregation | Handles large datasets; uses DB indexes; matches existing `countByGroup` pattern |
| Gantt rendering | Custom SVG component | D3.js; Chart.js; react-gantt | Zero dependencies; full control over layout; existing codebase avoids chart libraries |
| Sub-session indentation | Recursive parentId walk in JS | SQL recursion | Simpler; session sizes are small; matches existing parent walk in `mapSessionCreated` |
| Tooltip | CSS absolute positioning | React portal; D3 tip | Lightweight; no portal complexity; sufficient for this use case |

## Data Flow

```
Collector mappers → eventType field → usageEventSchema validation
    ↓
toRow() extracts eventType → DB column event_type
    ↓
Repository aggregations → GET /v1/sessions (GROUP BY session_id)
    ↓
Session detail query → GET /v1/sessions/:traceId (WHERE session_id = ?)
    ↓
Dashboard useApi hook → Sessions table → SessionDetail page → Gantt SVG
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `packages/event-schema/src/schemas.ts` | Modify | Add `eventType` enum to `executionSchema` |
| `packages/opencode-collector/src/mappers/session-mapper.ts` | Modify | Set `eventType: "session_created"` |
| `packages/opencode-collector/src/mappers/message-mapper.ts` | Modify | Set `eventType: "user_message"` / `"assistant_message"` |
| `packages/opencode-collector/src/mappers/tool-skill-mapper.ts` | Modify | Set `eventType: "tool_call"` / `"skill_call"` |
| `packages/database/src/schema.ts` | Modify | Add `eventType` text column + composite index |
| `packages/database/migrations/0001_add_event_type.sql` | Create | Migration SQL |
| `packages/database/src/repository.ts` | Modify | Add `findBySessionId`, `listSessions` methods |
| `apps/api/src/routes/sessions.ts` | Create | Session list + detail endpoints |
| `apps/api/src/server.ts` | Modify | Register `/v1/sessions` routes |
| `apps/dashboard/src/api/types.ts` | Modify | Add `SessionSummary`, `SessionEvent` types |
| `apps/dashboard/src/api/client.ts` | Modify | Add session API functions |
| `apps/dashboard/src/pages/SessionsPage.tsx` | Create | Session list table |
| `apps/dashboard/src/pages/SessionDetailPage.tsx` | Create | Session detail with Gantt |
| `apps/dashboard/src/components/SessionGantt.tsx` | Create | Custom SVG Gantt component |
| `apps/dashboard/src/App.tsx` | Modify | Add `/sessions` routes |
| `apps/dashboard/src/components/Layout.tsx` | Modify | Add Sessions nav item |

## Interfaces / Contracts

### Schema Change
```typescript
// packages/event-schema/src/schemas.ts
export const executionSchema = z.looseObject({
  traceId: z.string(),
  parentId: z.string().optional(),
  eventType: z.enum([
    'session_created', 'user_message', 'assistant_message',
    'tool_call', 'skill_call'
  ]).optional(),
});
```

### Repository Methods
```typescript
// packages/database/src/repository.ts
interface SessionSummary {
  traceId: string;
  agentName: string;
  eventCount: number;
  firstEventAt: Date;
  lastEventAt: Date;
  durationMs: number;
}

interface SessionEvent {
  id: string;
  eventType: string; // defaults to 'unknown' if null
  agentName: string;
  timestamp: Date;
  durationMs: number;
  status: string;
  execution: Record<string, unknown>;
}

listSessions(pagination: Pagination): Promise<PaginatedResult<SessionSummary>>;
findBySessionId(traceId: string): Promise<SessionEvent[]>;
```

### API Endpoints
```
GET /v1/sessions?limit=10&cursor=<traceId>
Response: { data: SessionSummary[], nextCursor: string | null }

GET /v1/sessions/:traceId
Response: { data: SessionEvent[] }
Error: { error: "Session not found" } (404)
```

### Dashboard Types
```typescript
// apps/dashboard/src/api/types.ts
interface SessionSummary {
  traceId: string;
  agentName: string;
  eventCount: number;
  firstEventAt: string;
  lastEventAt: string;
  durationMs: number;
}

interface SessionEvent {
  id: string;
  eventType: string;
  agentName: string;
  timestamp: string;
  durationMs: number;
  status: string;
  execution: { traceId: string; parentId?: string; [key: string]: unknown };
}
```

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | Schema accepts/rejects eventType | Jest with Zod safeParse |
| Unit | Mappers set correct eventType | Table-driven tests per mapper |
| Integration | Session list aggregations | Mock repository, supertest |
| Integration | Session detail ordering | Mock repository, supertest |
| Integration | 404 for missing session | Mock repository, supertest |
| E2E | Sessions page renders table | Vitest + React Testing Library |
| E2E | Gantt renders bars | Vitest + React Testing Library |
| E2E | Tooltip appears on hover | Vitest + React Testing Library |

## Threat Matrix

N/A — no routing, shell, subprocess, VCS/PR automation, executable-file classification, or process-integration boundary.

## Migration / Rollout

Drizzle migration adds nullable `event_type` column + composite index. Existing rows get NULL. No data loss. Down migration drops column and index. Feature is purely additive — no feature flags needed.

## Open Questions

- None — all decisions are grounded in existing codebase patterns.