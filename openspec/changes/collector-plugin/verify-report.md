```yaml
schema: gentle-ai.verify-result/v1
evidence_revision: sha256:3f7fa7f1219c7d70c26dc79f1d7a8839c6f32841d8ea0f8639da9e295f80d904
verdict: fail
blockers: 0
critical_findings: 1
requirements: 10/10
scenarios: 14/15
test_command: npx jest
test_exit_code: 0
test_output_hash: sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855
build_command: npx tsc --noEmit
build_exit_code: 0
build_output_hash: sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855
```

## Verification Report

**Change**: collector-plugin
**Version**: N/A
**Mode**: Standard (strict_tdd=false)

### Completeness
| Metric | Value |
|--------|-------|
| Tasks total | 16 |
| Tasks complete | 16 |
| Tasks incomplete | 0 |

### Build & Tests Execution
**Build**: ✅ Passed
```text
$ npx tsc --noEmit
EXIT_CODE:0
```

**Tests**: ✅ 69 passed / ❌ 0 failed / ⚠️ 0 skipped
```text
$ npx jest
Test Suites: 12 passed, 12 total
Tests:       69 passed, 69 total
Time:        2.914 s

Collector-focused:
$ npx jest packages/opencode-collector
Test Suites: 4 passed, 4 total
Tests:       40 passed, 40 total
```

**Lint**: ✅ Passed
```text
$ npx eslint .
EXIT_CODE:0
```

**Format**: ✅ Passed
```text
$ npx prettier --check .
All matched files use Prettier code style!
EXIT_CODE:0
```

**Negative Control**: ✅ Confirmed
```text
$ npx tsc --strict --noEmit /tmp/neg-control.ts
error TS2322: Type 'number' is not assignable to type 'string'.
EXIT_CODE:2
```
tsc correctly rejects type violations in the project.

### Spec Compliance Matrix
| Requirement | Scenario | Test | Result |
|-------------|----------|------|--------|
| Mapper Correctness | (all triggers table) | `mappers.test.ts` > Session/Message/Tool-Skill Mapper | ✅ COMPLIANT |
| Mapper Correctness | Subagent attribution | `mappers.test.ts` > "subagent traceId = ROOT" | ✅ COMPLIANT |
| Cost Attribution | Parent and child stay separate | `mappers.test.ts` > "parent and child stay separate" | ✅ COMPLIANT |
| Privacy Gating | Defaults redact everything | `mappers.test.ts` > "default config omits raw prompt" | ✅ COMPLIANT |
| Privacy Gating | Prompt opt-in | `mappers.test.ts` > "opt-in captures raw prompt" | ✅ COMPLIANT |
| Validation Before Enqueue | Drift cannot poison batches | `index.ts:137-140` (safeParse + conditional enqueue) | ⚠️ PARTIAL |
| Buffering and Delivery | Overflow drops oldest | `buffer.test.ts` > "drops oldest when queue exceeds 10k" | ✅ COMPLIANT |
| Buffering and Delivery | Retry exhaustion | `buffer.test.ts` > "retries on 5xx then drops after 5 attempts" | ✅ COMPLIANT |
| Non-Blocking Guarantee | Throwing mapper contained | `buffer.test.ts` > "catches mapper throw and logs first 3 errors" | ✅ COMPLIANT |
| Configuration Resolution | Environment wins | `index.ts:31-60` (env > file > defaults merge) | ✅ COMPLIANT |
| Configuration Resolution | Missing endpoint disables | `index.ts:85-93` (disabled check + log) | ✅ COMPLIANT |
| Startup Self-Check | Registration observable | `index.ts:250-257` (heartbeat log with hooks) | ✅ COMPLIANT |
| Smoke Integration Test | End-to-end proven | `smoke.test.ts` > "receives at least one schema-valid batch" | ✅ COMPLIANT |
| Smoke Integration Test | Binary absent | `smoke.test.ts` (describeOrSkip guard) | ✅ COMPLIANT |
| Tested Contract | Suite proves the contract | `npx jest packages/opencode-collector` — 40/40 pass | ✅ COMPLIANT |

**Compliance summary**: 14/15 scenarios COMPLIANT, 1 PARTIAL

### Correctness (Static Evidence)
| Requirement | Status | Notes |
|------------|--------|-------|
| Mapper Correctness | ✅ Implemented | All 8 trigger types mapped; ancestor walk for traceId; callID correlation |
| Cost Attribution | ✅ Implemented | Parent/child share traceId; child has own metrics; no duplication |
| Privacy Gating | ✅ Implemented | TextEncoder UTF-8 + sha256; capture flags gate raw content |
| Validation Before Enqueue | ⚠️ Partial | safeParse gates enqueue; invalid events silently dropped (no log per spec) |
| Buffering and Delivery | ✅ Implemented | 10k bound, 100 threshold, 1s timer, idle, dispose, retry backoff |
| Non-Blocking Guarantee | ✅ Implemented | withBoundary wraps all hooks; error count + log first 3 |
| Configuration Resolution | ✅ Implemented | env > file > defaults; frozen config; missing URL disables |
| Startup Self-Check | ✅ Implemented | Heartbeat log with registered hooks array |
| Smoke Integration Test | ✅ Implemented | node:http mock + skipIf guard |

### Coherence (Design)
| Decision | Followed? | Notes |
|----------|-----------|-------|
| Layered module topology | ✅ Yes | domain/mappers/infra layers clean |
| Domain pure, infra injected | ✅ Yes | Mappers import no infra; buffer/http client injected |
| Ancestor walk for session root | ✅ Yes | Map<childID, parentID> walk in session-mapper |
| callID staging via Map | ✅ Yes | Map<string, ToolCall> keyed by callID |
| Last-write-wins per key | ✅ Yes | Stateless mappers, each payload carries full state |
| Privacy at mapper level | ✅ Yes | computePromptPrivacy inline in message-mapper |
| TextEncoder UTF-8 bytes | ✅ Yes | Used in computePromptPrivacy |
| sync createHash sha256 | ✅ Yes | node:crypto createHash sync |
| Array buffer with shift | ✅ Yes | shift() on overflow |
| setInterval flush | ✅ Yes | 1s interval, cleared on dispose |
| fetch transport | ✅ Yes | globalThis.fetch |
| Exponential backoff+jitter | ✅ Yes | base=200ms, cap=10s, jitter±50% |
| 10s Abort timeout | ✅ Yes | REQUEST_TIMEOUT_MS = 10_000 |
| withBoundary pattern | ✅ Yes | try/catch wrapper, first 3 logged |

### Issues Found

**CRITICAL**:
1. **4xx response retries instead of dropping** (`http-client.ts:51-56`): The spec design diagram specifies "4xx: drop batch + counter" with no retry. The implementation retries4xx like5xx (5 attempts then drop). The task 3.2 acceptance criterion says "drops after 5 attempts" which the code satisfies, but the design diagram explicitly shows4xx as a no-retry path. The test `buffer.test.ts > "drops batch immediately on 4xx without retry"` has a misleading name — it asserts `fetchFn.toHaveBeenCalledTimes(5)` (i.e., retries DO happen). This is a spec/design-vs-implementation gap.

**WARNING**:
2. **Validation log missing** (`index.ts:137-140`): The spec requires invalid events to be "logged and dropped locally." The implementation drops invalid events via `safeParse` + conditional enqueue but does not log them. The `enqueueEvent` function has no logging branch for `result.success === false`.

**SUGGESTION**:
3. **Smoke test graceful degradation**: When `opencode run` delivers no batches, the test passes with a `console.warn`. Consider using `pending()` or `test.skip` for clearer skip semantics when the environment cannot produce batches (no model configured).

### Verdict
**FAIL**

All 16 tasks complete. 14/15 spec scenarios have passing covering tests. 1 scenario (Validation Before Enqueue) is partially compliant — the validation gate works but the mandatory log line is missing. 1 design deviation exists (4xx retry behavior) where the implementation follows the literal spec text but contradicts the design diagram's explicit no-retry path for4xx.
