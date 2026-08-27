# Delta for Usage Collector

## ADDED Requirements

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

### Requirement: Test Coverage

Mapper tests MUST verify that each mapper returns the correct `eventType` value. Tests MUST use table-driven fixtures per the existing pattern.

#### Scenario: All mappers emit eventType

- GIVEN the mapper test suite
- WHEN `jest` runs against `packages/opencode-collector`
- THEN every mapper test asserts the correct `eventType` value
