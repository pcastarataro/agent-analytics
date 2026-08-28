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
| `tool.execute.before` | opens tool call keyed by `callID`; `input.tool === 'skill'` seeds SKILL event with `skill.name` from args; extracts `version`/`definitionHash` from skill args when present |
| `tool.execute.after` | closes the open call via `callID` correlation; when tool is `skill`, calls `mapSkillComplete` with name/version/definitionHash from the stored `ToolCall` |
| ToolPart completed/error | TOOL final form: `durationMs` from state timestamps; status from error state; MCP tools keep full name |
| skill ToolPart completion | closes SKILL event; version/hash via definition-ladder helpers |
| AssistantMessage (`message.updated`) | MODEL-CALL completion: provider/model IDs; metrics via `extractTokenMetrics`; `result.status` via `resolveStatus` (incl. `MessageAbortedError` → `cancelled`) |

#### Scenario: Subagent attribution

- GIVEN a child session created with parentID under root session R
- WHEN its assistant message completes
- THEN its event sets `parentId` to the invoking execution and `traceId = R`, not the child id

#### Scenario: Skill tool before propagates version metadata

- GIVEN a `tool.execute.before` payload with `tool: "skill"` and args containing `version` and `definitionHash`
- WHEN `mapToolBefore` processes it
- THEN the emitted event includes `skill.version` and `skill.definitionHash` from the args

#### Scenario: Skill tool after calls mapSkillComplete

- GIVEN a `tool.execute.after` for a skill call with version/hash stored on ToolCall
- WHEN `handleToolAfter` processes it
- THEN the event type is `"skill_call"` and skill version/hash are included

### Requirement: Agent Version Propagation

The collector SHALL populate `agent.version` and `agent.definitionHash` on every event that includes an agent context. When the agent has a user-uploaded definition, version and definitionHash SHALL be extracted from the definition metadata. When the agent is built-in (no uploaded definition), `definitionHash` SHALL be set to the sentinel `"builtin:<agentName>"` and `version` SHALL remain `undefined`.

#### Scenario: User-defined agent emits version and hash

- GIVEN a session created with agent name "research-agent" linked to definition hash `a1b2c3` version `1.2.0`
- WHEN any event is emitted for that session
- THEN the event's `agent.version` equals `"1.2.0"` and `agent.definitionHash` equals `"a1b2c3"`

#### Scenario: Built-in agent emits builtin sentinel hash

- GIVEN a session created with built-in agent name "coder" (no uploaded definition)
- WHEN any event is emitted for that session
- THEN `agent.definitionHash` equals `"builtin:coder"` and `agent.version` is `undefined`

#### Scenario: Agent without definition info populates name only

- GIVEN a session created with agent name "unknown"
- WHEN an event is emitted before agent metadata is resolved
- THEN `agent.name` equals `"unknown"`, `agent.version` is `undefined`, and `agent.definitionHash` is `undefined`

### Requirement: Skill Version Propagation

`mapToolBefore` SHALL extract `version` and `definitionHash` from skill tool arguments when the tool is `"skill"` and those fields are present in `args`. The extracted values SHALL be stored on the `ToolCall` record and carried through to the emitted event. `mapSkillComplete` SHALL be called from `handleToolAfter` when the completed tool is `"skill"`, passing the skill's name, version, and definitionHash from the stored `ToolCall`.

#### Scenario: Skill args carry version and hash

- GIVEN a `tool.execute.before` payload with `tool: "skill"` and `args: { name: "research", version: "0.3.1", definitionHash: "d4e5f6" }`
- WHEN `mapToolBefore` processes the payload
- THEN the emitted event's `skill.version` is `"0.3.1"` and `skill.definitionHash` is `"d4e5f6"`

#### Scenario: Skill args without version/hash

- GIVEN a `tool.execute.before` payload with `tool: "skill"` and `args: { name: "research" }` (no version/hash)
- WHEN `mapToolBefore` processes the payload
- THEN the emitted event's `skill.version` is `undefined` and `skill.definitionHash` is `undefined`

#### Scenario: Skill completion emits skill_call event type

- GIVEN a `tool.execute.after` payload for a skill tool call with `ToolCall` record containing `skillName: "research"`, `version: "0.3.1"`, `definitionHash: "d4e5f6"`
- WHEN `handleToolAfter` processes the completion
- THEN `mapSkillComplete` is called and the emitted event has `execution.eventType: "skill_call"` with skill version and hash populated

#### Scenario: Non-skill tool completion does not call mapSkillComplete

- GIVEN a `tool.execute.after` payload for a non-skill tool (e.g., `"web_search"`)
- WHEN `handleToolAfter` processes the completion
- THEN `mapSkillComplete` is NOT called and the event type remains `"tool_call"`

### Requirement: ExecutionContext Version Fields

`ExecutionContext` and `ToolCall` interfaces SHALL include optional `version?: string` and `definitionHash?: string` fields. These fields are populated during mapper execution and consumed when building the final event.

#### Scenario: ToolCall carries version metadata

- GIVEN a `ToolCall` created by `mapToolBefore` for a skill with version `"0.3.1"` and definitionHash `"d4e5f6"`
- WHEN the `ToolCall` is later consumed by `mapToolAfter` or `mapSkillComplete`
- THEN the version and definitionHash values are accessible on the `ToolCall` record

#### Scenario: ExecutionContext without version fields

- GIVEN an `ExecutionContext` created by `mapSessionCreated` without explicit version info
- WHEN the context is used to build events
- THEN `version` and `definitionHash` on the context are `undefined` and do not appear in the emitted event

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

On startup, the plugin SHALL call `buildIndex(dirs)` which performs a recursive readdir of configured definition directories and builds a `Map<name, {path, type}>` index. This step MUST NOT read file contents or upload definitions. The startup heartbeat log SHALL confirm index population (definition count). `buildIndex` MUST complete in <50ms for typical installs (~100 definitions).

#### Scenario: Index built without file reads

- GIVEN configured definition directories containing skill and agent files
- WHEN the plugin starts
- THEN `buildIndex` populates the name→path index, no file contents are read, and no uploads occur

#### Scenario: Startup heartbeat confirms index

- GIVEN the plugin finishes startup
- WHEN the heartbeat log entry is emitted
- THEN it reports the number of definitions indexed

#### Scenario: Index build under time budget

- GIVEN ~100 definition files across directories
- WHEN `buildIndex` runs
- THEN it completes in <50ms

### Requirement: Lazy Definition Upload

`ensureDefinition(hash, name?)` SHALL resolve definitions lazily on cache miss. When a name is provided and found in the index, the system MUST read the file at the resolved path, compute its hash, and upload via PUT. When the name is missing or not in the index, the system SHALL still cache the hash to prevent retry loops (hash-only guard preserved). Uploads MUST be fire-and-forget — they MUST NOT block event delivery.

#### Scenario: Cache miss triggers lazy upload

- GIVEN an event referencing definition name "research-skill" not yet in the hash cache
- WHEN `ensureDefinition` is called with the name and hash
- THEN the file is read from the index-resolved path, hashed, and uploaded via PUT; the hash is cached for future hits

#### Scenario: Cache hit skips upload

- GIVEN a definition hash already cached from a prior event
- WHEN `ensureDefinition` is called with the same hash
- THEN no file read or upload occurs

#### Scenario: Name not in index falls back to hash-only guard

- GIVEN an event referencing definition name "unknown-skill" not present in the index
- WHEN `ensureDefinition` is called
- THEN the hash is cached (preventing retry loops), a warning is logged, and no upload occurs

#### Scenario: Fire-and-forget upload does not block delivery

- GIVEN a lazy upload triggered by a cache miss
- WHEN the upload is initiated
- THEN event delivery continues without waiting for the upload to complete

### Requirement: Event-to-Definition Name Threading

`enqueueEvent` SHALL extract the definition name (skill name or agent name) from the event fields and pass it to `ensureDefinition`. The name extraction MUST be best-effort — missing or ambiguous names MUST NOT throw or block the event path.

#### Scenario: Skill event passes skill name

- GIVEN an enqueued event with `skill.name = "research"`
- WHEN the event reaches the definition upload path
- THEN `ensureDefinition` receives `name = "research"` alongside the hash

#### Scenario: Agent event passes agent name

- GIVEN an enqueued event with `agent.name = "coder"`
- WHEN the event reaches the definition upload path
- THEN `ensureDefinition` receives `name = "coder"` alongside the hash

#### Scenario: Missing name does not block

- GIVEN an enqueued event with neither `skill.name` nor `agent.name`
- WHEN the event reaches the definition upload path
- THEN `ensureDefinition` is called with `name = undefined` and the hash-only guard applies

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
