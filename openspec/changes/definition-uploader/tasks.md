# Tasks: Definition Uploader

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 350–450 |
| 400-line budget risk | Medium |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 → PR 2 |
| Delivery strategy | ask-on-risk |
| Chain strategy | feature-branch-chain |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: feature-branch-chain
400-line budget risk: Medium

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|------|------|-----------|----------------------|-----------------|-------------------|
| 1 | Types + HTTP client extension + uploader core (scan, hash, cache) | PR 1 | `vitest run --filter definition-uploader` | Mock fs + fetch; verify scan/hash/cache logic | `definition-uploader.ts`, `types.ts`, `http-client.ts` partial |
| 2 | Collector integration (startup hook + lazy fallback) + tests | PR 2 | `vitest run --filter index` | Full plugin lifecycle mock; verify startup scan + fallback | `index.ts` changes only |

## Phase 1: Foundation — Types

- [x] 1.1 Add `DefinitionPayload` interface to `packages/opencode-collector/src/domain/types.ts` — `{ hash: string; name: string; type: 'skill' | 'agent'; content: string; version?: string; path: string }`

## Phase 2: HTTP Client Extension

- [x] 2.1 Add `putDefinition(payload: DefinitionPayload)` to `createHttpClient` return in `packages/opencode-collector/src/infra/http-client.ts` — PUT `${config.url}/v1/definitions/${payload.hash}`, same retry/timeout pattern as `postBatch`, 4xx → log warn + return (idempotent), 5xx → retry 3x then drop
- [x] 2.2 Export `DefinitionPayload` import in `http-client.ts` from `../domain/types`

## Phase 3: Core Uploader

- [x] 3.1 Create `packages/opencode-collector/src/infra/definition-uploader.ts` with `DefinitionUploaderDeps` interface — deps: `readFile`, `readdir`, `putDefinition`, `log`
- [x] 3.2 Implement `computeHash(content: string): string` — SHA-256 via `node:crypto`, deterministic hex output
- [x] 3.3 Implement `scanDefinitions(dirs: string[])` — `readdirSync` + `readFileSync`, skip ENOENT dirs silently (debug log), skip files >1MB (warn), skip unreadable files (warn), compute hash + build `DefinitionPayload`, call `putDefinition`, add to `uploadedHashes` set
- [x] 3.4 Implement `ensureDefinition(hash: string)` — check `uploadedHashes.has(hash)`, if miss: fire-and-forget `putDefinition` + add to set (lazy fallback, don't block caller)
- [x] 3.5 Export `createDefinitionUploader(deps)` factory returning `{ scanDefinitions, ensureDefinition, uploadedHashes }`

## Phase 4: Collector Integration

- [ ] 4.1 In `packages/opencode-collector/src/index.ts`, import `createDefinitionUploader` and `readFileSync`/`readdirSync`/`join` from `node:fs`/`node:path`
- [ ] 4.2 After `httpClient` creation in `createPlugin`, instantiate uploader with deps (`readFile`, `readdir`, `httpClient.putDefinition`, `logFn`), resolve scan dirs: `~/.config/opencode/skills/` + `~/.config/opencode/agents/`
- [ ] 4.3 Call `uploader.scanDefinitions()` at startup (after log "Collector started"), catch errors — log warn + continue, never block startup
- [ ] 4.4 In `enqueueEvent`, before enqueueing: extract `definitionHash` from `fields.agent?.definitionHash` or `fields.skill?.definitionHash`, call `uploader.ensureDefinition(hash)` if present — fire-and-forget, no await

## Phase 5: Tests

- [ ] 5.1 Unit test `computeHash` — same input → same hash, different input → different hash
- [ ] 5.2 Unit test `scanDefinitions` skips missing dirs — mock `readdir` throwing ENOENT, verify no error, warn not logged
- [ ] 5.3 Unit test `scanDefinitions` skips large files — mock `readFileSync` returning >1MB string, verify warn logged, file skipped
- [ ] 5.4 Unit test `ensureDefinition` cache hit — pre-populate `uploadedHashes`, verify `putDefinition` NOT called
- [ ] 5.5 Unit test `ensureDefinition` cache miss — empty set, verify `putDefinition` called + hash added to set
- [ ] 5.6 Unit test `putDefinition` retry on 5xx — mock fetch returning 500, verify 3 retries then give up
- [ ] 5.7 Unit test `putDefinition` no retry on 4xx — mock fetch returning 400, verify single attempt
- [ ] 5.8 Integration test startup scan → upload — mock fs + fetch, verify all defs uploaded in order
- [ ] 5.9 Integration test lazy fallback mid-event — verify event processing not blocked by upload

## Implementation Order

1. Phase 1 (types) → unblocks everything
2. Phase 2 (http-client) → unblocks Phase 3
3. Phase 3 (uploader core) → unblocks Phase 4
4. Phase 4 (integration) → depends on Phases 1–3
5. Phase 5 (tests) → validates Phases 1–4

PR 1 scope: Phases 1–3 (types + http-client + uploader core + unit tests)
PR 2 scope: Phases 4–5 (integration + integration tests)
