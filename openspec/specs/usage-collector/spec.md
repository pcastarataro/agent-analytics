# Usage Collector Specification

## Purpose

Defines `packages/opencode-collector`: an OpenCode plugin turning hook activity into canonical UsageEvents. It consumes the existing `usage-event-schema` contract unchanged and adds correlation, privacy gating, buffered delivery, configuration resolution, and a non-blocking hook boundary.

## Requirements

### Requirement: Mapper Correctness

Mappers SHALL convert OpenCode payloads to UsageEvents per this pinned table (stateless last-write-wins per key):

| Trigger | Mapping |
|---|---|
| `session.created`, root (no parentID) | stages execution context; `execution.traceId = session.id` |
| `session.created`, child (parentID set) | also `execution.parentId = parentID`; `traceId` = ROOT ancestor session id, never the child id |
| user message | starts agent execution; agent resolved from `UserMessage.agent` |
| `tool.execute.before` | opens tool call keyed by `callID`; `input.tool === 'skill'` seeds SKILL event with `skill.name` from args |
| `tool.execute.after` | closes the open call via `callID` correlation |
| ToolPart completed/error | TOOL final form: `durationMs` from state timestamps; status from error state; MCP tools keep full name |
| skill ToolPart completion | closes SKILL event; version/hash via definition-ladder helpers |
| AssistantMessage (`message.updated`) | MODEL-CALL completion: provider/model IDs; metrics via `extractTokenMetrics`; `result.status` via `resolveStatus` (incl. `MessageAbortedError` → `cancelled`) |

#### Scenario: Subagent attribution

- GIVEN a child session created with parentID under root session R
- WHEN its assistant message completes
- THEN its event sets `parentId` to the invoking execution and `traceId = R`, not the child id

### Requirement: Cost Attribution and Roll-Up Rule

Every assistant message SHALL emit its own execution event attributed to ITS session's agent, with `parentId` linking to the invoking execution. Events MUST NOT duplicate or inflate cost/metrics; roll-up across a trace happens ONLY at read time (dashboard/API).

#### Scenario: Parent and child stay separate

- GIVEN an architect@x parent session with a backend child session
- WHEN both complete
- THEN two execution events share one traceId; child metrics exist only in the child's event

### Requirement: Privacy Gating

Capture flags `prompts`, `responses`, `toolArguments` SHALL default false. When off, events carry `promptLength`/`responseLength` (UTF-8 byte length) and `promptHash` (sha256 hex) ONLY — never raw prompts, responses, or tool arguments. When a flag is true, its corresponding raw field MAY be included.

#### Scenario: Defaults redact everything

- GIVEN default configuration
- WHEN any payload is mapped
- THEN only lengths/hashes appear; no raw content or tool arguments in the event

#### Scenario: Prompt opt-in

- GIVEN `capture.prompts=true`
- WHEN mapped
- THEN the raw prompt MAY appear; responses and tool arguments stay gated

### Requirement: Validation Before Enqueue

Every emitted event MUST parse against `usageEventSchema` before enqueue. Invalid events are logged and dropped locally — never sent, never thrown.

#### Scenario: Drift cannot poison batches

- GIVEN an event failing validation
- WHEN enqueue is attempted
- THEN it is logged, dropped, and absent from every POSTed batch

### Requirement: Buffering and Delivery

The system SHALL flush when 100 events are queued OR a 1s timer fires OR `session.idle` OR dispose. The queue is bounded at 10,000 events with drop-oldest plus a dropped counter. Failed deliveries retry with exponential backoff + jitter up to ~5 attempts, then drop the batch with a counter increment. Batches POST to the configured endpoint. Network failures MUST NOT propagate into OpenCode.

#### Scenario: Overflow drops oldest

- GIVEN a full queue and one more event
- WHEN it is enqueued
- THEN the oldest event is dropped, the dropped counter increments, and the new event queues

#### Scenario: Retry exhaustion

- GIVEN a permanently failing endpoint
- WHEN five attempts elapse
- THEN the batch drops with counter increment and operation continues

### Requirement: Non-Blocking Guarantee

No exception from any hook path SHALL reach OpenCode (defensive boundary wraps every hook).

#### Scenario: Throwing mapper contained

- GIVEN a mapper that throws on a malformed payload
- WHEN the hook runs
- THEN it returns normally and the error is counted/logged

### Requirement: Configuration Resolution

Precedence SHALL be: environment variables > `.opencode/analytics.json` collector section > pure-domain defaults. Required keys: endpoint URL, API key, userId. Privacy flags resolve through the same chain. A missing endpoint disables the collector with a single log line, still non-blocking.

#### Scenario: Environment wins

- GIVEN the URL present in both env and JSON file
- WHEN resolved
- THEN the env value is used

#### Scenario: Missing endpoint disables

- GIVEN no URL from any source
- WHEN the plugin starts
- THEN it logs once and stays disabled; hooks unaffected

### Requirement: Startup Self-Check

The plugin SHALL emit a startup heartbeat/self-check via `client.app.log` so silent unknown-hook misconfiguration is detectable.

#### Scenario: Registration observable

- GIVEN the plugin loads
- WHEN startup finishes
- THEN a heartbeat log entry names the registered hooks

### Requirement: Smoke Integration Test

A headless `opencode run` against a local mock server MUST assert at least one schema-valid batch is received, guarded by `describe.skipIf` when the binary is absent so CI stays green.

#### Scenario: End-to-end proven

- GIVEN the opencode binary installed
- WHEN the smoke test runs
- THEN the mock server receives ≥1 schema-valid batch

#### Scenario: Binary absent

- GIVEN no opencode binary
- WHEN the suite runs
- THEN the smoke test skips

### Requirement: Event Type Assignment

Each mapper SHALL set `execution.eventType` on the emitted event according to this mapping:

| Mapper / Hook | eventType Value |
|---|---|
| `mapSessionCreated` | `session_created` |
| `mapUserMessage` | `user_message` |
| `mapAssistantMessage` | `assistant_message` |
| `mapToolBefore` / `mapToolAfter` / `mapToolPart` | `tool_call` |
| `mapSkillComplete` | `skill_call` |

The `eventType` field MUST be added to the `execution` object returned by each mapper.

#### Scenario: Session created gets correct type

- GIVEN `mapSessionCreated` is called for a root session
- WHEN the execution context is built
- THEN the returned execution object includes `eventType: "session_created"`

#### Scenario: User message gets correct type

- GIVEN `mapUserMessage` is called with a valid payload
- WHEN the mapper returns the event fields
- THEN the execution object includes `eventType: "user_message"`

#### Scenario: Tool call before/after gets correct type

- GIVEN `mapToolBefore` or `mapToolAfter` is called
- WHEN the mapper returns the event fields
- THEN the execution object includes `eventType: "tool_call"`

#### Scenario: Skill completion gets correct type

- GIVEN `mapSkillComplete` is called
- WHEN the mapper returns the event fields
- THEN the execution object includes `eventType: "skill_call"`

#### Scenario: Assistant message gets correct type

- GIVEN `mapAssistantMessage` is called with a valid payload
- WHEN the mapper returns the event fields
- THEN the execution object includes `eventType: "assistant_message"`

### Requirement: Backward Compatibility with Pre-Migration Events

Events emitted by older collectors will NOT have `eventType`. The collector MUST NOT break if downstream consumers ignore the field. The schema's `z.looseObject` guarantees this.

#### Scenario: Missing eventType tolerated

- GIVEN an event emitted by a pre-migration collector
- WHEN it reaches the API or database
- THEN the event is accepted and `eventType` is `undefined`/`null`

### Requirement: Tested Contract

All behaviors above MUST be covered by Jest unit tests via the shared preset: table-driven fixture-based mapper tests; buffer/retry tests using fake timers and injected fetch.

#### Scenario: Suite proves the contract

- GIVEN the collector suites
- WHEN `npx jest packages/opencode-collector` runs
- THEN tests pass with at least one case per scenario in this spec
