# Design: Definition Uploader

## Technical Approach

Add a definition uploader that scans `~/.config/opencode/skills/` and `~/.config/opencode/agents/` at startup, computes SHA-256 hashes of file contents, and uploads definitions to the backend via PUT. A lazy fallback ensures definitions not pre-uploaded are sent on first reference. The design follows existing DI patterns (factory functions, injected deps, counters) and keeps all I/O non-blocking.

## Architecture Decisions

| Decision | Choice | Alternatives | Rationale |
|----------|--------|--------------|-----------|
| Upload trigger | Startup scan + lazy fallback | Startup-only, event-driven | Covers both known definitions and edge cases where files change after startup |
| Hash storage | In-memory `Set<string>` | Redis, file cache | Definitions are session-scoped; no persistence needed. Simple and fast |
| HTTP method | PUT `/v1/definitions/:hash` | POST with body hash | Idempotent by design; server can upsert safely on retries |
| File scanning | `readdirSync` + `readFileSync` | Async glob | Startup is single-threaded; sync is simpler and acceptable for small config dirs |
| Error strategy | Log + continue | Fail fast, retry indefinitely | Startup must not block; lazy fallback handles transient failures |

## Data Flow

```
Startup                          Runtime (lazy)
   │                                │
   ▼                                ▼
scanDirs()                    onEvent(definitionHash)
   │                                │
   ▼                                ▼
readFiles() ──→ computeHash()   cache.has(hash)?
   │                │              │         │
   │                ▼           YES ▼      NO ▼
   │         cache.add(hash)   return    uploadDef()
   │                │                       │
   ▼                ▼                       ▼
uploadDef() ◄──────┘                  cache.add(hash)
   │
   ▼
PUT /v1/definitions/:hash
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `packages/opencode-collector/src/infra/definition-uploader.ts` | Create | Core uploader: scan, hash, cache, upload, lazy fallback |
| `packages/opencode-collector/src/infra/http-client.ts` | Modify | Add `putDefinition` method following `postBatch` pattern |
| `packages/opencode-collector/src/index.ts` | Modify | Call `scanDefinitions` at startup, expose `ensureDefinition` on hooks context |
| `packages/opencode-collector/src/domain/types.ts` | Modify | Add `DefinitionPayload` interface |

## Interfaces / Contracts

```typescript
// domain/types.ts
export interface DefinitionPayload {
  hash: string;
  name: string;
  type: 'skill' | 'agent';
  content: string;
  version?: string;
  path: string;
}

// infra/definition-uploader.ts
export interface DefinitionUploaderDeps {
  readFile: (path: string) => string;
  readdir: (path: string) => string[];
  putDefinition: (payload: DefinitionPayload) => Promise<void>;
  log: (entry: { service: string; level: string; message: string }) => void;
}

export interface DefinitionUploader {
  scanDefinitions(): Promise<void>;
  ensureDefinition(hash: string): Promise<void>;
  uploadedHashes: Set<string>;
}
```

```typescript
// infra/http-client.ts — new method on returned object
putDefinition(payload: DefinitionPayload): Promise<void>
// PUT ${config.url}/v1/definitions/${payload.hash}
// Same retry/timeout pattern as postBatch
// 4xx → log warn, do not retry (idempotent PUT, likely duplicate)
// 5xx → retry with backoff, max 3 attempts (lazy, non-critical)
```

## Error Handling Strategy

| Scenario | Behavior | Log Level |
|----------|----------|-----------|
| Directory doesn't exist | Skip silently on startup | debug |
| File read permission denied | Log + skip file, continue scan | warn |
| File too large (>1MB) | Skip + warn | warn |
| SHA-256 computation fails | Skip file, continue | warn |
| PUT 4xx (client error) | Log + add to cache anyway (avoid retry loop) | warn |
| PUT 5xx (server error) | Retry 3x with backoff, then skip | error |
| PUT network error | Same as 5xx retry | error |
| Lazy fallback triggered during event | Fire-and-forget, don't block event processing | info |

Startup errors are logged but never throw — the collector must start even if definitions fail. Lazy fallback uses `void promise` (fire-and-forget) to avoid blocking event handlers.

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | `computeHash` determinism | Mock `crypto.createHash`, verify same input → same hash |
| Unit | `scanDefinitions` skips missing dirs | Mock `readdir` to throw ENOENT, verify no error thrown |
| Unit | `scanDefinitions` skips large files | Mock `readFileSync` returning >1MB, verify warn logged |
| Unit | `ensureDefinition` cache hit | Pre-populate cache, verify no PUT call |
| Unit | `ensureDefinition` cache miss | Empty cache, verify PUT called + cache updated |
| Unit | `putDefinition` retry logic | Mock fetch 500 → verify 3 retries then give up |
| Unit | `putDefinition` 4xx no retry | Mock fetch 400 → verify single attempt |
| Integration | Startup scan → upload flow | Mock fs + fetch, verify all defs uploaded in order |
| Integration | Lazy fallback mid-event | Verify event processing not blocked by upload |

## Threat Matrix

| Boundary | Applicability | Reason |
|----------|---------------|--------|
| Documentation-like paths | N/A | Reading config files, not classifying executables |
| Git repository selection | N/A | No git operations |
| Commit state | N/A | No VCS operations |
| Push state | N/A | No git push |
| PR commands | N/A | No PR automation |

## Migration / Rollout

No migration required. The uploader is additive — existing events continue working. Definitions uploaded are purely informational metadata for the backend.

## Open Questions

- [ ] Should `version` be extracted from file content (e.g., frontmatter) or always omitted?
- [ ] Max file size threshold — 1MB reasonable for skill/agent definitions?
- [ ] Should we add a `definitions.enabled` config flag to opt-out of scanning?
