# Proposal: Lazy Definition Upload

## Intent

Startup scans ALL definition files eagerly — reads every `SKILL.md`/`agent.md`, computes hashes, uploads via PUT. With many skills/agents installed, this is slow and uploads content that may never be referenced. The lazy approach defers read + hash + upload until the first event actually uses a definition, keeping startup fast.

## Scope

### In Scope
- Replace `scanDefinitions()` with `buildIndex()` — recursive readdir only (no reads, no uploads)
- Rewrite `ensureDefinition(hash, name?)` — on cache miss, resolve name→path from index, read file, hash, upload
- Pass definition name from `enqueueEvent` to `ensureDefinition`
- Update unit tests for new behavior

### Out of Scope
- Changing the `DefinitionPayload` contract or PUT endpoint
- Config flags (`definitions.enabled`) — future enhancement
- Version extraction from file content — remains omitted for now
- Stale definition detection or cache invalidation

## Capabilities

### New Capabilities
None

### Modified Capabilities
- `usage-collector`: Startup behavior changes from eager upload to index-only scan; lazy upload moves from no-op to real upload on cache miss

## Approach

1. **Build index at startup**: `buildIndex(dirs)` — recursive readdir, build `Map<name, {path, type}>` by directory context. No file reads, no uploads. ~10ms for typical installs.
2. **Lazy upload on first use**: `ensureDefinition(hash, name?)` — on cache miss, lookup path by `name` in index, read file, compute hash, upload via PUT. Fire-and-forget (already the pattern at call site).
3. **Update call site in `index.ts`**: Extract agent/skill name from event fields, pass to `ensureDefinition`.
4. **Keep hash-only guard**: If name is missing or not in index, still cache hash to prevent retry loops (current behavior preserved).

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `packages/opencode-collector/src/infra/definition-uploader.ts` | Modified | Replace `scanDefinitions` with `buildIndex`, rewrite `ensureDefinition` |
| `packages/opencode-collector/src/index.ts` | Modified | Pass name to `ensureDefinition` from event context |
| `packages/opencode-collector/src/__tests__/definition-uploader.test.ts` | Modified | Tests for lazy upload, index building |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| First-use latency on lazy upload blocks event delivery | Low | Already fire-and-forget (`void`); PUT is fast for small files |
| Name mismatch between event and index entry | Low | Hash-only fallback still works; log warning on lookup miss |
| Index stale if definitions added after startup | Low | Out of scope; same limitation as current eager scan |

## Rollback Plan

Revert `definition-uploader.ts` to previous version (revert git commit). The `scanDefinitions` and `ensureDefinition` signatures remain compatible — `index.ts` changes are minimal. No DB migrations, no external API changes.

## Dependencies

- None — self-contained change within `opencode-collector` package

## Success Criteria

- [ ] `buildIndex()` completes in <50ms on typical install (~100 definitions)
- [ ] `ensureDefinition()` uploads on first cache miss, skips on hit
- [ ] Existing unit tests pass; new tests cover lazy upload path
- [ ] Startup time measurably faster (no file reads at init)
