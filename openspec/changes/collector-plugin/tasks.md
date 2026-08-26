# Tasks: Collector Plugin

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~1,240 (B1' ~500, B2' ~365, B3' ~375) |
| Chained PRs recommended | Yes |
| Suggested split | PR 1: B1' (Foundation + Mappers + Fixtures) → PR 2: B2' (Buffer + HTTP + Boundary) → PR 3: B3' (Entry + Shim + Smoke) |
| Delivery strategy | ask-on-risk |
| Chain strategy | stacked-to-main |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: Medium

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|------|------|-----------|----------------------|-----------------|-------------------|
| 1 | Foundation + mappers + fixtures | PR 1 | `npx jest packages/opencode-collector --testPathPattern=mappers` | N/A — pure unit tests | src/domain/*, src/mappers/*, src/fixtures/* |
| 2 | Buffer + HTTP + boundary | PR 2 | `npx jest packages/opencode-collector --testPathPattern=buffer` | Fake timers + injected fetch | src/infra/* |
| 3 | Entry + shim + smoke | PR 3 | `npx jest packages/opencode-collector --testPathPattern=smoke` | Mock HTTP server + skipIf guard | src/index.ts, .opencode/plugins/analytics.ts |

## Phase 1: Foundation (PR 1)

- [x] 1.1 Create `src/domain/config-schema.ts` with zod schema (`url`, `apiKey`, `userId` optional; `capture.prompts/responses/toolArguments` default false; `disabled` default false) and frozen `CollectorConfig` type — **Acceptance**: schema parses valid JSON; rejects non-URL url; capture defaults to false — spec: Configuration Resolution
- [x] 1.2 Create `src/domain/types.ts` with `ExecutionContext` (sessionId, traceId, parentId?, agentName?), `ToolCall` (callID, toolName, startTime, endTime?, status?), and parent→child edge map type — **Acceptance**: types compile; used by all mappers — spec: Mapper Correctness
- [x] 1.3 Create `src/mappers/session-mapper.ts` with `mapSessionCreated(payload, config)` → sets `execution.traceId = session.id`; walks `parentID` edge map to find root ancestor; stages `ExecutionContext` keyed by sessionId — **Acceptance**: root sets traceId=self; child finds root via ancestor walk; parentId set on child — spec: Mapper Correctness, Subagent attribution
- [x] 1.4 Create `src/mappers/message-mapper.ts` with `mapUserMessage(payload, context, config)` (prompt length/hash, privacy gate via `computePromptPrivacy`) and `mapAssistantMessage(payload, context, config)` (provider/model IDs, `extractTokenMetrics`, `resolveStatus`, duration) — **Acceptance**: user msg computes UTF-8 byte length + sha256 hash; default-off omits raw prompt; assistant msg extracts tokens and resolves error/cancelled/success — spec: Privacy Gating, Mapper Correctness
- [x] 1.5 Create `src/fixtures/opencode-payloads.ts` with typed fixture payloads: session.created root, session.created child, user message, assistant message (success + error + aborted), tool.execute.before, tool.execute.after, ToolPart completed/error, skill ToolPart — **Acceptance**: every fixture compiles against its hook type; each fixture is named per its trigger — spec: Tested Contract
- [x] 1.6 Create `src/__tests__/mappers.test.ts` with table-driven tests: session root sets traceId, child walks to root and sets parentId, user message default redacts content, user message opt-in exposes prompt, assistant maps tokens/status/duration, subagent traceId = ROOT — **Acceptance**: all cases pass; at least one test per Mapper Correctness scenario — spec: Tested Contract, Mapper Correctness, Subagent attribution, Cost Attribution

## Phase 2: Tool-Skill Mapping (PR 1, continued)

- [x] 2.1 Create `src/mappers/tool-skill-mapper.ts` with `mapToolBefore` (stages `ToolCall` by callID; seeds SKILL event if `tool === 'skill'`), `mapToolAfter` (closes call via callID correlation), `mapToolPart` (final TOOL form: durationMs, status), `mapSkillComplete` (SKILL close with definitionHash/version via event-schema helpers) — **Acceptance**: callID correlation works; skill detection seeds skill.name; ToolPart computes duration; tolerant of unknown after-shape fields — spec: Mapper Correctness, Privacy Gating
- [x] 2.2 Add tool-skill test cases to `src/__tests__/mappers.test.ts`: skill tool seeds SKILL event, before/after correlation via callID, ToolPart completion maps duration/status, error ToolPart sets status error, unknown after-shape fields dropped (no throw), skill definitionHash/version from helpers — **Acceptance**: all cases pass — spec: Tested Contract

## Phase 3: Buffer + HTTP Client (PR 2)

- [ ] 3.1 Create `src/infra/event-buffer.ts` with `EventBuffer` class: bounded `Array<UsageEvent>` (10k max, drop-oldest + counter); flush at `length >= 100` or 1s `setInterval` tick or `dispose()`; exposes `enqueue`, `flush`, `onSessionIdle`, `dispose`, `counters` — **Acceptance**: enqueue past 10k drops oldest; flush at 100 events; timer fires after 1s; dispose drains — spec: Buffering and Delivery, Overflow drops oldest
- [ ] 3.2 Create `src/infra/http-client.ts` with `HttpClient` class: `postBatch(events, config)` using `globalThis.fetch` + `AbortController` (10s timeout); retry exponential backoff (base 200ms, cap 10s, jitter ±50%) up to 5 attempts; on final failure drop batch + increment counter; POST `/v1/events/batch` with `X-API-Key` header — **Acceptance**: POST sends correct body/headers; retry on 5xx/network with backoff; drops after 5 attempts — spec: Buffering and Delivery, Retry exhaustion
- [ ] 3.3 Create `src/infra/boundary.ts` with `withBoundary(fn, client)` helper: wraps hook in try/catch, counts errors, logs first 3 via `client.app.log`, suppresses subsequent, always returns void — **Acceptance**: error increments counter; first 3 logged; suppressed after; return value is always void — spec: Non-Blocking Guarantee, Throwing mapper contained
- [ ] 3.4 Create `src/__tests__/buffer.test.ts` with fake-timer + injected-fetch tests: flush threshold at 100 events, 1s timer flush, drop-oldest counter at 10k queue bound, retry-then-drop on permanent failure (5 attempts), non-blocking: `withBoundary` catches mapper throw and returns — **Acceptance**: all counter values correct; fetch called expected times; timer-driven flush works — spec: Buffering and Delivery, Overflow drops oldest, Retry exhaustion, Non-Blocking Guarantee

## Phase 4: Entry + Wiring (PR 3)

- [ ] 4.1 Replace `src/index.ts` with plugin factory: bootstrap `CollectorConfig` (env > `.opencode/analytics.json` > defaults → frozen); if `url` missing → `disabled=true`, single log; register all hooks wrapped in `withBoundary`; startup heartbeat via `client.app.log` naming registered hooks — **Acceptance**: config resolves in precedence order; missing URL disables; self-check log emitted; hooks never throw — spec: Configuration Resolution, Startup Self-Check, Non-Blocking Guarantee
- [ ] 4.2 Create `.opencode/plugins/analytics.ts` shim: re-exports `createPlugin` from `../../packages/opencode-collector/src/index.ts` — **Acceptance**: Bun resolves shim when OpenCode loads local plugins — spec: In Scope (TS-source-first packaging)

## Phase 5: Smoke Test (PR 3)

- [ ] 5.1 Create `src/__tests__/smoke.test.ts`: start `node:http` mock server on ephemeral port; set `OPENCODE_CONFIG_DIR` to fixture dir; spawn `opencode run` with trivial prompt; assert ≥1 schema-valid batch POSTed; guard with `describe.skipIf(!hasOpencodeBinary)` — **Acceptance**: mock receives ≥1 valid batch; test skips when binary absent — spec: Smoke Integration Test, End-to-end proven, Binary absent
- [ ] 5.2 Run `npx jest packages/opencode-collector` — confirm all suites (mappers + buffer + smoke) pass — **Acceptance**: green output; at least one case per spec scenario — spec: Tested Contract, Suite proves the contract

## Traceability Matrix

| Spec Scenario | Task(s) |
|---|---|
| Mapper Correctness (all triggers) | 1.3, 1.4, 2.1 |
| Subagent attribution | 1.3, 1.6 |
| Parent and child stay separate (Cost Attribution) | 1.3, 1.6 |
| Defaults redact everything (Privacy) | 1.4, 1.6 |
| Prompt opt-in (Privacy) | 1.4, 1.6 |
| Drift cannot poison batches (Validation) | 3.1, 3.2, 3.4 |
| Overflow drops oldest | 3.1, 3.4 |
| Retry exhaustion | 3.2, 3.4 |
| Throwing mapper contained (Non-Blocking) | 3.3, 3.4, 4.1 |
| Environment wins (Config) | 4.1 |
| Missing endpoint disables | 4.1 |
| Registration observable (Startup) | 4.1 |
| End-to-end proven (Smoke) | 5.1 |
| Binary absent (Smoke) | 5.1 |
| Suite proves the contract | 5.2 |
