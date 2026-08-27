# Tasks: Session Traceability & Gantt Visualization

## Review Workload Forecast

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: High

| Unit | Goal | PR | Test command | Harness | Rollback boundary |
|------|------|----|-------------|---------|-------------------|
| 1 | Schema + Collector + DB | PR 1 | `vitest run --filter event-schema` | N/A unit only | Revert schema/mappers/migration |
| 2 | API session endpoints | PR 2 | `vitest run --filter api` | `curl /v1/sessions` | Remove session routes |
| 3 | Dashboard + Gantt | PR 3 | `vitest run --filter dashboard` | Navigate /sessions → detail | Remove session pages |

## Phase 1: Schema + Collector + DB (PR1)

- [ ] 1.1 **T1** Add `eventType` enum to `executionSchema` in `packages/event-schema/src/schemas.ts:15`. Add optional enum field to existing `z.looseObject`. Spec: "Valid event type accepted" + "Undefined accepted". **~3 lines** — no deps
- [ ] 1.2 **T2** Schema tests in `packages/event-schema/src/__tests__/schemas.test.ts`. Four cases: valid accepted, missing accepted, invalid rejected, backward compat. Spec: "Test Coverage". **~30 lines** — depends: T1
- [ ] 1.3 **T3** Set `eventType: "session_created"` in `mapSessionCreated` return at `packages/opencode-collector/src/mappers/session-mapper.ts:21`. Spec: "Session created gets correct type". **~1 line** — depends: T1
- [ ] 1.4 **T4** Set `eventType: "user_message"` / `"assistant_message"` in `mapUserMessage` and `mapAssistantMessage` at `packages/opencode-collector/src/mappers/message-mapper.ts:33,91`. Spec: "User message" + "Assistant message". **~2 lines** — depends: T1
- [ ] 1.5 **T5** Set `eventType: "tool_call"` in `mapToolBefore/After/Part` and `"skill_call"` in `mapSkillComplete` at `packages/opencode-collector/src/mappers/tool-skill-mapper.ts:19,39,71,95`. Spec: "Tool call" + "Skill completion". **~4 lines** — depends: T1
- [ ] 1.6 **T6** Mapper tests in `packages/opencode-collector/src/__tests__/mappers.test.ts`. Table-driven: each mapper asserts correct eventType. Spec: "All mappers emit eventType". **~25 lines** — depends: T3-T5
- [ ] 1.7 **T7** Add `eventType: text('event_type')` column + `index('idx_session_id_timestamp').on(table.sessionId, table.timestamp)` in `packages/database/src/schema.ts`. Spec: "Database Column" + "Composite Index". **~3 lines** — no deps
- [ ] 1.8 **T8** Create `packages/database/migrations/0001_add_event_type.sql`. Up: ALTER TABLE + CREATE INDEX. Down: DROP INDEX + DROP COLUMN. Spec: "Schema Migration". **~8 lines** — depends: T7
- [ ] 1.9 **T9** Update `toRow()` in `packages/database/src/repository.ts:99` to extract `eventType` from `event.execution`. Spec: "New column accepts event type". **~2 lines** — depends: T7

## Phase 2: API Endpoints (PR2)

- [x] 2.1 **T10** Define `SessionSummary` + `SessionEvent` interfaces and add `listSessions` + `findBySessionId` to `EventRepository` in `packages/database/src/repository.ts`. Spec: "Session List" + "Session Detail". **~25 lines** — depends: T7
- [x] 2.2 **T11** Implement `listSessions`: GROUP BY `session_id`, count/min/max timestamps, cursor pagination. In `createDrizzleRepository`. Spec: "List sessions" + "Cursor pagination". **~35 lines** — depends: T10
- [x] 2.3 **T12** Implement `findBySessionId`: SELECT WHERE session_id = ? ORDER BY timestamp ASC, null eventType → "unknown". Spec: "Session detail ordered" + "Events include eventType". **~20 lines** — depends: T10
- [x] 2.4 **T13** Create `apps/api/src/routes/sessions.ts`. GET / (listSessions) + GET /:traceId (findBySessionId, 404 if empty). Follow `events.ts` pattern. Spec: all session endpoint scenarios. **~40 lines** — depends: T10-T12
- [x] 2.5 **T14** Register routes in `apps/api/src/server.ts`. Import + `app.use('/v1/sessions', createSessionRoutes(repository))`. Spec: integration wiring. **~2 lines** — depends: T13
- [x] 2.6 **T15** API tests in `apps/api/src/__tests__/sessions.test.ts`. List aggregations, cursor pagination, empty list, detail ordered events, 404, eventType null→"unknown". Spec: "Test Coverage". **~60 lines** — depends: T14

## Phase 3: Dashboard + Gantt (PR3)

- [ ] 3.1 **T16** Add `SessionSummary` + `SessionEvent` types, update `UsageEventDTO.execution` in `apps/dashboard/src/api/types.ts`. Spec: "TypeScript Types". **~25 lines** — no deps
- [ ] 3.2 **T17** Add `fetchSessions(limit,cursor)` + `fetchSessionDetail(traceId)` in `apps/dashboard/src/api/client.ts`. Spec: "Sessions page loads from API". **~15 lines** — depends: T16
- [ ] 3.3 **T18** Create `apps/dashboard/src/pages/SessionsPage.tsx`. Sortable table (traceId truncated, agent, events, started, duration). Click → navigate. Empty state. Spec: all list scenarios. **~65 lines** — depends: T17
- [ ] 3.4 **T19** Create `apps/dashboard/src/components/SessionGantt.tsx`. SVG Gantt: color-coded bars by eventType, dots for zero-duration, adaptive time axis, parentId indentation, hover tooltip, legend. Spec: all Gantt scenarios. **~120 lines** — depends: T16
- [ ] 3.5 **T20** Create `apps/dashboard/src/pages/SessionDetailPage.tsx`. Fetch detail, metadata header, render Gantt, loading/empty states. Spec: "Session Detail Page". **~30 lines** — depends: T17, T19
- [ ] 3.6 **T21** Update `apps/dashboard/src/App.tsx`. Add `/sessions` + `/sessions/:id` routes. Spec: "Navigation Update". **~5 lines** — depends: T18, T20
- [ ] 3.7 **T22** Add `{ to: '/sessions', label: 'Sessions' }` to `navItems` in `apps/dashboard/src/components/Layout.tsx:5`. Spec: "Sessions nav link". **~1 line** — no deps
- [ ] 3.8 **T23** Component tests in `apps/dashboard/__tests__/pages/SessionsPage.test.tsx`. Rows render, click navigates, empty state. Spec: "Test Coverage". **~35 lines** — depends: T18
- [ ] 3.9 **T24** Component tests in `apps/dashboard/__tests__/components/SessionGantt.test.tsx`. Bars render, zero-duration dots, tooltip on hover, legend visible. Spec: "Test Coverage". **~40 lines** — depends: T19
- [ ] 3.10 **T25** Component test in `apps/dashboard/__tests__/pages/SessionDetailPage.test.tsx`. Loads detail, renders Gantt, shows metadata. Spec: "Test Coverage". **~20 lines** — depends: T20, T19

## Threat Matrix

N/A — no routing, shell, subprocess, or process-integration boundary.
