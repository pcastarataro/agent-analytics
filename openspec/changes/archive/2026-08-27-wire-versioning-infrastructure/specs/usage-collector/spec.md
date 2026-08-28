# Delta for Usage Collector

## ADDED Requirements

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

## MODIFIED Requirements

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

(Previously: `tool.execute.before` did not extract version/hash from skill args; `tool.execute.after` did not call `mapSkillComplete`)

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

## REMOVED Requirements

(No requirements removed in this change.)

## RENAMED Requirements

(No requirements renamed in this change.)
