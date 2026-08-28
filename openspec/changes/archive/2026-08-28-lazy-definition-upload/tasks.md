# Tasks: Lazy Definition Upload

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~120 (90 prod + 30 test) |
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
| 1 | Full change | Single PR | `npx vitest run packages/opencode-collector/src/__tests__/definition-uploader.test.ts` | Real scenario: startup loads index only; event triggers lazy upload | `definition-uploader.ts` + `index.ts` — revert both |

## Phase 1: Core Changes (definition-uploader.ts)

- [x] 1.1 Replace `scanDefinitions` with `buildIndex` — recursive readdir only, builds `Map<name, {path, type}>` index, no file reads, no uploads. Return count. Mock: readdir returns names, assert readFile never called, assert index populated.
- [x] 1.2 Rewrite `ensureDefinition(hash, name?)` — on cache miss, lookup `name` in index, read file at path, compute hash, upload via PUT (fire-and-forget `void`). If name missing or not in index, cache hash only + log warning. If file not found, log warning + cache hash.
- [x] 1.3 Update `DefinitionUploader` interface: rename `scanDefinitions` → `buildIndex`, add optional `name?: string` param to `ensureDefinition`.
- [x] 1.4 Remove `scanFile` helper and `inferName`/`inferType` functions (now handled by `buildIndex` + `ensureDefinition` at upload time).

## Phase 2: Integration (index.ts)

- [x] 2.1 Replace `uploader.scanDefinitions(definitionDirs)` call with `const indexedCount = await uploader.buildIndex(definitionDirs)` and log the count.
- [x] 2.2 In `enqueueEvent`, extract `name` from event fields: `agent.name || skill.name || undefined` and pass to `uploader.ensureDefinition(defHash, name)`.
- [x] 2.3 Update startup log message to include definition count from `buildIndex` return value.

## Phase 3: Tests

- [x] 3.1 RED: Write `buildIndex` test — mock readdir, assert readFile never called, assert index has correct name→path mapping and count returned.
- [x] 3.2 GREEN: Implement `buildIndex` to pass test from 3.1.
- [x] 3.3 RED: Write `ensureDefinition` cache-miss test — name in index, assert readFile called, assert putDefinition called with correct payload, assert hash cached.
- [x] 3.4 GREEN: Implement `ensureDefinition` to pass test from 3.3.
- [x] 3.5 RED: Write `ensureDefinition` name-not-in-index test — assert hash cached, assert warning logged, assert no putDefinition call.
- [x] 3.6 RED: Write `ensureDefinition` file-not-found test — readFile throws, assert warning logged, assert hash cached, no crash.
- [x] 3.7 Remove old `scanDefinitions` tests (tests for recursion, 1MB limit, duplicate hash skip) — replace with `buildIndex` equivalents or remove if covered by integration.

## Phase 4: Cleanup

- [x] 4.1 Remove `scanDefinitions` from exports if present — verify no other consumers.
- [x] 4.2 Verify startup log includes definition count and no file reads occurred (manual or integration check).
- [x] 4.3 Verify `inferType` and `inferName` are used by `buildIndex` (name from dir context, type from path) — keep as internal helpers, remove only if unused.
