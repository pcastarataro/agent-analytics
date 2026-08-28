# Tasks: Wire Versioning Infrastructure

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 60–80 |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | Single PR |
| Delivery strategy | single-pr |
| Chain strategy | size-exception |

Decision needed before apply: Yes
Chained PRs recommended: No
Chain strategy: size-exception
400-line budget risk: Low

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|------|------|-----------|----------------------|-----------------|-------------------|
| 1 | Types + mapper extraction | PR 1 | `pnpm --filter @agent-analytics/opencode-collector test` | N/A — unit tests | Revert `types.ts` + `tool-skill-mapper.ts` |
| 2 | Collector event propagation | PR 1 | `pnpm --filter @agent-analytics/opencode-collector test` | N/A — unit tests | Revert `index.ts` |
| 3 | Dashboard hash fix | PR 1 | `pnpm --filter @agent-analytics/dashboard test` | N/A — unit test on `computeHash` | Revert `DefinitionUpload.tsx` |

## Phase 1: Domain Types

- [ ] 1.1 Add `version?: string` and `definitionHash?: string` to `ExecutionContext` interface in `packages/opencode-collector/src/domain/types.ts`
- [ ] 1.2 Add `version?: string` and `definitionHash?: string` to `ToolCall` interface in `packages/opencode-collector/src/domain/types.ts`

## Phase 2: Mapper — Extract & Propagate Version/Hash

- [ ] 2.1 In `mapToolBefore` (`packages/opencode-collector/src/mappers/tool-skill-mapper.ts`), inside the `tool === 'skill'` branch: extract `version` and `definitionHash` from `args`, store on `ToolCall` record, and include in returned `skill` object using conditional spread
- [ ] 2.2 In `mapToolAfter` (`packages/opencode-collector/src/mappers/tool-skill-mapper.ts`), include `version` and `definitionHash` from the `ToolCall` record in the returned `skill` object (same conditional-spread pattern)
- [ ] 2.3 Add test fixture `skillToolExecuteBeforeWithVersion` to `packages/opencode-collector/src/fixtures/opencode-payloads.ts` with args including `version` and `definitionHash`
- [ ] 2.4 Add test cases to `packages/opencode-collector/src/__tests__/mappers.test.ts`: (a) `mapToolBefore` with version/hash args populates ToolCall and returned skill, (b) `mapToolBefore` without version/hash keeps them undefined, (c) `mapToolAfter` carries version/hash from ToolCall to output
- [ ] 2.5 Verify: run `pnpm --filter @agent-analytics/opencode-collector test` — all existing + new tests pass

## Phase 3: Collector Event Propagation

- [ ] 3.1 In `handleToolAfter` (`packages/opencode-collector/src/index.ts`): after `mapToolAfter` returns, look up the `ToolCall` by `callID`; if `tc.toolName === 'skill' && tc.skillName`, call `mapSkillComplete({ skill: { name, version, definitionHash } })` and merge result into `fields` via `Object.assign`
- [ ] 3.2 Import `mapSkillComplete` from `'./mappers'` in `packages/opencode-collector/src/index.ts`
- [ ] 3.3 In `handleSessionCreated`, propagate `ctx.version` and `ctx.definitionHash` into the `agent` event fields (conditional spread, matching design spec)
- [ ] 3.4 In `handleMessageUpdated`, propagate `ctx.version` and `ctx.definitionHash` into the `agent` event fields
- [ ] 3.5 In `handleToolBefore`, propagate `ctx.version` and `ctx.definitionHash` into the `agent` event fields
- [ ] 3.6 In `handleToolAfter`, propagate `ctx.version` and `ctx.definitionHash` into the `agent` event fields
- [ ] 3.7 Add test fixture `toolExecuteAfterSkill` with a skill ToolCall pre-seeded (with version/hash) to `packages/opencode-collector/src/fixtures/opencode-payloads.ts`
- [ ] 3.8 Add integration test cases to `packages/opencode-collector/src/__tests__/index.test.ts` or `mappers.test.ts`: (a) `handleToolAfter` for skill tool emits `eventType: 'skill_call'` with version/hash, (b) `handleToolAfter` for non-skill tool does NOT emit `skill_call`
- [ ] 3.9 Verify: run `pnpm --filter @agent-analytics/opencode-collector test` — all tests pass

## Phase 4: Dashboard — Fix computeHash

- [ ] 4.1 Change `computeHash` signature in `apps/dashboard/src/components/DefinitionUpload.tsx` from `computeHash(entityType, entityName)` to `computeHash(content)` — hash the `content` string instead of `${entityType}:${entityName}`
- [ ] 4.2 Update `handleSave` call site: replace `computeHash(entityType, entityName)` with `computeHash(content)`
- [ ] 4.3 Verify manually: upload same content with different entity names → same hash; upload different content with same entity name → different hash. Run `pnpm --filter @agent-analytics/dashboard build` — no type errors.

## Phase 5: Final Verification

- [ ] 5.1 Run full collector test suite: `pnpm --filter @agent-analytics/opencode-collector test`
- [ ] 5.2 Run dashboard build: `pnpm --filter @agent-analytics/dashboard build`
- [ ] 5.3 Run full project build/typecheck to confirm no regressions
