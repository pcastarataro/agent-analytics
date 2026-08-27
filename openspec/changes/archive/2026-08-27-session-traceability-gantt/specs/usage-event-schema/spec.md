# Delta for Usage Event Schema

## ADDED Requirements

### Requirement: Execution Event Type Classification

The `execution` sub-schema SHALL include an optional `eventType` field with enum values: `session_created | user_message | assistant_message | tool_call | skill_call`. The field MUST be absent or `undefined` for events emitted before migration — consumers MUST treat missing `eventType` as `"unknown"`.

#### Scenario: Valid event type accepted

- GIVEN a UsageEvent with `execution.eventType = "tool_call"`
- WHEN parsed against `usageEventSchema`
- THEN validation succeeds and `eventType` is present on the output

#### Scenario: Undefined event type accepted (backward compat)

- GIVEN a UsageEvent with no `execution.eventType` field
- WHEN parsed against `usageEventSchema`
- THEN validation succeeds and `eventType` is `undefined` in the output

#### Scenario: Invalid event type rejected

- GIVEN a UsageEvent with `execution.eventType = "invalid_value"`
- WHEN parsed against `usageEventSchema`
- THEN validation fails with a type error on `execution.eventType`

### Requirement: Schema Backward Compatibility

The addition of `execution.eventType` is additive and non-breaking. Existing events without `eventType` MUST remain valid. The `execution` sub-schema uses `z.looseObject` which tolerates the new field. Consumers MUST NOT assume `eventType` is always present.

#### Scenario: Older events pass new schema

- GIVEN an event from a collector that does not set `eventType`
- WHEN parsed by the updated schema
- THEN validation succeeds with `eventType` as `undefined`

#### Scenario: Newer events pass old schema

- GIVEN an event with `execution.eventType` set
- WHEN parsed by a schema version that does not know about `eventType`
- THEN validation succeeds (unknown nested key tolerated by looseObject)

### Requirement: Test Coverage

Schema tests MUST cover: (1) valid eventType accepted, (2) missing eventType accepted, (3) invalid eventType rejected, (4) backward compatibility with older events.

#### Scenario: Test suite covers all cases

- GIVEN the event-schema test suite
- WHEN `jest` runs from root
- THEN all eventType-related tests pass
