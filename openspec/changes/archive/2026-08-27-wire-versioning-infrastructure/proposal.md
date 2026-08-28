# Proposal: Wire End-to-End Versioning Infrastructure

## Intent

The schema, database, API, and dashboard all have versioning support — but the collector never populates `version` or `definitionHash` on events, and the dashboard's definition upload hashes entity name instead of content. Version breakdowns in the dashboard show only `unknown` for every agent/skill. This change completes the wiring so version data flows from collector to storage to display.

## Scope

### In Scope
- Extend `ExecutionContext` with optional `version` and `definitionHash` fields
- Wire `mapToolBefore` to extract `version`/`definitionHash` from skill tool args
- Call `mapSkillComplete` from `handleToolAfter` when a skill call completes, passing version/hash
- Use `builtinDefinitionHash` in collector for built-in agents/skills without definitions
- Fix `DefinitionUpload.computeHash` to hash actual content (not `entityType:entityName`)
- Update collector tests for new version/hash propagation

### Out of Scope
- Automatic version detection from definition content changes
- Version comparison/diffing UI
- Migration tooling for existing `unknown`-version events
- Changes to schema, database schema, API routes, or dashboard pages (all already built)

## Capabilities

### New Capabilities
- None

### Modified Capabilities
- `usage-collector`: Mapper correctness — extract and propagate version/definitionHash through events
- `dashboard-ui`: DefinitionUpload fix — hash content instead of entity name for correct definition lookup

## Approach

Four surgical edits across 4 files (~60–80 lines):

1. **`packages/opencode-collector/src/domain/types.ts`** — Add `version?: string` and `definitionHash?: string` to `ExecutionContext` and `ToolCall`
2. **`packages/opencode-collector/src/mappers/tool-skill-mapper.ts`** — In `mapToolBefore`, extract `version` and `definitionHash` from skill args when present. Update `ToolCall` usage to carry them.
3. **`packages/opencode-collector/src/index.ts`** — In `handleToolAfter`, when the completed tool is `skill`, call `mapSkillComplete` with name/version/definitionHash from the `ToolCall`. In `enqueueEvent` defaults, keep `unknown` (callers override). In `handleToolBefore`, propagate version/hash from mapper result into event fields.
4. **`apps/dashboard/src/components/DefinitionUpload.tsx`** — Fix `computeHash` to accept content string, hash `content` (not `entityType:entityName`). Update `handleSave` to pass `content` to `computeHash`.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `packages/opencode-collector/src/domain/types.ts` | Modified | Add `version`/`definitionHash` to `ExecutionContext` and `ToolCall` |
| `packages/opencode-collector/src/mappers/tool-skill-mapper.ts` | Modified | Extract version/hash from skill args in `mapToolBefore` |
| `packages/opencode-collector/src/index.ts` | Modified | Call `mapSkillComplete` on skill completion; propagate version/hash |
| `apps/dashboard/src/components/DefinitionUpload.tsx` | Modified | Fix `computeHash` to hash actual content |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Existing events without version/hash remain valid | Certain | Schema uses optional fields; backward compatible by design |
| `mapSkillComplete` called from wrong hook path | Low | Only call from `handleToolAfter` when tool is `skill`, guarded by ToolCall lookup |
| Content hash changes break existing definition lookups | Medium | Hash format changes; old hashes are `entityType:entityName`, new are content-based. Existing definitions with old hashes will NOT match. Acceptable: definitions are user-uploaded and re-save is trivial. |

## Rollback Plan

1. Revert all 4 files to pre-change state (git checkout)
2. Collector continues to emit events with `version: undefined` / `definitionHash: undefined` — all existing consumers tolerate this
3. Dashboard definition upload reverts to entity-name hashing — functional but incorrect for content-based lookup
4. No database migration needed — no schema changes

## Dependencies

- Existing `resolveDefinitionVersion()` and `builtinDefinitionHash()` helpers (already in `@agent-analytics/event-schema`)
- Existing `mapSkillComplete` function (already in tool-skill-mapper.ts, just unused)
- Existing Zod schema optional fields for version/definitionHash (already in schemas.ts)

## Success Criteria

- [ ] Collector emits events with `agent.version` and `agent.definitionHash` populated for non-built-in agents
- [ ] Collector emits events with `skill.version` and `skill.definitionHash` populated from tool args
- [ ] Built-in agents/skills get `definitionHash: "builtin:<name>"` sentinel
- [ ] `DefinitionUpload.computeHash` produces content-based hashes — same content always yields same hash
- [ ] Dashboard definition detail page resolves definitions by content hash correctly
- [ ] All existing tests pass; new tests cover version/hash propagation paths
