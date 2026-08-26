# Usage Event Schema Specification

## Purpose

Defines the canonical `UsageEvent` contract (`@agent-analytics/event-schema`) that couples the OpenCode collector with the ingestion API: a zod schema as single source of truth, inferred types, field-level contract rules, version/hash resolution, error-taxonomy status mapping, helper purity, backward-compatibility policy, and mandatory test coverage.

## Requirements

### Requirement: Canonical UsageEvent Zod Contract

`@agent-analytics/event-schema` SHALL export a zod schema as the single source of truth for `UsageEvent`; the exported TypeScript type MUST be inferred from that schema (no hand-maintained duplicate). The package SHALL remain pure-domain: its only runtime dependency is `zod`, with no I/O and no imports from apps or infrastructure packages.

The top-level object MUST validate strictly: the allowed key set is exactly `id`, `actor`, `project`, `session`, `execution`, `agent`, `skill`, `tool`, `model`, `metrics`, `result`. An event carrying ANY unknown top-level key SHALL be rejected. Nested objects SHOULD tolerate unrecognized properties so newer collectors can add fields additively without breaking older consumers (see Backward Compatibility).

#### Scenario: Minimal valid event accepted

- GIVEN an event with a valid `id` and all ten groups carrying only their mandatory fields
- WHEN parsed
- THEN validation succeeds and the inferred value round-trips the input

#### Scenario: Unknown top-level key rejected

- GIVEN an otherwise valid event carrying extra top-level key `extra`
- WHEN parsed
- THEN validation fails identifying the unexpected top-level key

#### Scenario: Missing mandatory field rejected

- GIVEN an event omitting a mandatory field such as `result.status`
- WHEN parsed
- THEN validation fails reporting that exact path

### Requirement: Field-Level Contract Rules

| Field | Rule |
|---|---|
| `id` | REQUIRED; client-generated UUIDv7 string |
| `execution.traceId` | REQUIRED; equals the root session id |
| `execution.parentId` | OPTIONAL; present for child executions |
| `actor.userId` | REQUIRED; upstream source is collector env `OPENCODE_ANALYTICS_USER` |
| `agent`, `skill` | `name` REQUIRED; `version?` and `definitionHash?` OPTIONAL |
| `metrics.durationMs`, `inputTokens`, `outputTokens`, `cachedTokens`, `cost` | each OPTIONAL number |
| `result.status` | REQUIRED enum `success \| error \| cancelled` |

The schema validates format only; id uniqueness and `userId` sourcing are producer responsibilities.

#### Scenario: Approved additions validated

- GIVEN an event whose `id` is UUIDv7 and whose `traceId` equals the root session id, without `parentId`
- WHEN parsed
- THEN validation succeeds

#### Scenario: Malformed identity rejected

- GIVEN an event whose `id` is not a valid UUIDv7 or whose `metrics.cost` is a string
- WHEN parsed
- THEN validation fails on the offending field

### Requirement: Definition Version and Hash Resolution

An exported pure helper SHALL resolve a definition version via the ladder: explicit version (e.g. skill metadata, then shared manifest) → literal `'unknown'`. For built-in agents/skills lacking a definition file, `definitionHash` SHALL be the sentinel string `builtin:<name>` — never null, undefined, or empty.

#### Scenario: Ladder resolution

- GIVEN definitions with an explicit version and without any
- WHEN the helper resolves each
- THEN it returns the explicit version where present and `'unknown'` otherwise

#### Scenario: Built-in sentinel hash

- GIVEN built-in agent `explore` with no definition file
- WHEN the helper computes its hash input
- THEN it yields exactly `builtin:explore`

### Requirement: Status Mapping From Error Taxonomy

An exported pure helper SHALL map OpenCode errors to `result.status`: no error → `success`; `MessageAbortedError` → `cancelled`; ANY other error, known or unrecognized, → `error`.

#### Scenario: Mapping table

- GIVEN inputs `undefined`, `MessageAbortedError`, `ProviderAuthError`, and an unknown `SomeNewError`
- WHEN mapped
- THEN results are respectively `success`, `cancelled`, `error`, `error`

### Requirement: Helper Purity

All normalization helpers MUST be deterministic and side-effect free: same input always yields same output; no I/O, clock, environment, or network access; no mutation of arguments.

#### Scenario: Deterministic and non-mutating

- GIVEN any helper called twice with equal inputs
- WHEN both calls complete
- THEN outputs are deeply equal and the input object is unchanged

### Requirement: UsageEvent Contract Backward Compatibility

This change ESTABLISHES v1 of the contract coupling collector and API. Evolution policy: adding optional NESTED fields MUST keep events valid under older schemas (consumers ignore unknown nested keys); adding a TOP-LEVEL key or removing/retyping any existing field is BREAKING and MUST bump the schema package's major version, requiring API-first coordinated deployment.

#### Scenario: Newer producer, older consumer

- GIVEN an event from a future collector carrying an additional optional nested property
- WHEN parsed by the current schema
- THEN validation succeeds and the unknown nested key is not rejected

#### Scenario: Breaking top-level addition is gated

- GIVEN a hypothetical event with a new top-level key
- WHEN parsed by the current schema
- THEN it is rejected — confirming top-level evolution requires a major version bump

### Requirement: Tested Contract

Every behavior above — schema acceptance/rejection, field rules, ladder, sentinel, mapping table, purity — MUST be covered by Jest unit tests executable via the shared preset from the repository root.

#### Scenario: Suite proves the contract

- GIVEN the event-schema test suite
- WHEN `jest` runs from root
- THEN all tests pass covering at least one case per scenario in this spec
