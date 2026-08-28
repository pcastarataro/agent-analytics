# Archive Report: Wire End-to-End Versioning Infrastructure

**Change**: wire-versioning-infrastructure
**Status**: Complete
**Archived**: 2026-08-27

## Summary

Completed the wiring of `version` and `definitionHash` from collector events through to dashboard display. The schema, database, API, and dashboard already supported versioning, but the collector never populated these fields and the dashboard's definition upload hashed entity name instead of content.

## Final State Facts

| Metric | Value |
|--------|-------|
| Implementation tasks | 16/16 complete |
| Lines changed | 89 across 6 files |
| Tests passing | 154/154 |
| TypeScript | Compiles clean |
| Spec requirements | All verified PASS |

## Files Changed

| File | Action | Description |
|------|--------|-------------|
| `packages/opencode-collector/src/domain/types.ts` | Modified | Added `version?: string` and `definitionHash?: string` to `ExecutionContext` and `ToolCall` interfaces |
| `packages/opencode-collector/src/mappers/tool-skill-mapper.ts` | Modified | Extracted `version`/`definitionHash` from skill args in `mapToolBefore`; included in `mapToolAfter` return |
| `packages/opencode-collector/src/index.ts` | Modified | Called `mapSkillComplete` when tool is `skill` in `handleToolAfter`; propagated version/hash to event fields |
| `apps/dashboard/src/components/DefinitionUpload.tsx` | Modified | Fixed `computeHash` to hash `content` (not `entityType:entityName`) |
| `packages/opencode-collector/src/fixtures/opencode-payloads.ts` | Modified | Added `skillToolExecuteBeforeWithVersion` and `toolExecuteAfterSkill` fixtures |
| `packages/opencode-collector/src/__tests__/mappers.test.ts` | Modified | Added test cases for version/hash propagation through mappers |

## Requirements Delivered

### usage-collector (3 new, 1 modified)

**Agent Version Propagation** (ADDED): Collector populates `agent.version` and `agent.definitionHash` on every event. Built-in agents get `builtin:<name>` sentinel.

**Skill Version Propagation** (ADDED): `mapToolBefore` extracts version/hash from skill args. `mapToolComplete` called from `handleToolAfter` for skill completions.

**ExecutionContext Version Fields** (ADDED): `ExecutionContext` and `ToolCall` interfaces include optional `version` and `definitionHash` fields.

**Mapper Correctness** (MODIFIED): Updated mapping table to reflect version/hash extraction from skill args and `mapSkillComplete` invocation from `handleToolAfter`.

### dashboard-ui (2 modified)

**Markdown Definition Viewer** (MODIFIED): `DefinitionUpload.computeHash` now hashes actual content string, not `entityType:entityName`. Same content always produces same hash.

**Backward Compatibility with Pre-Existing Definitions** (MODIFIED): Existing definitions with old `entityType:entityName` hashes remain accessible. New uploads produce content-based hashes only.

## Archive Contents

- proposal.md
- specs/usage-collector/spec.md
- specs/dashboard-ui/spec.md
- design.md
- tasks.md (all tasks checked)
- archive-report.md (this file)

## Source of Truth Updated

The following specs now reflect the new behavior:
- `openspec/specs/usage-collector/spec.md` — merged version/hash propagation requirements
- `openspec/specs/dashboard-ui/spec.md` — merged computeHash fix and backward compatibility requirements

## SDD Cycle Complete

The change has been fully planned, implemented, verified, and archived.
