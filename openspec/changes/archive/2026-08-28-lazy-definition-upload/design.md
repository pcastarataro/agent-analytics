# Design: Lazy Definition Upload

## Technical Approach

Replace the eager `scanDefinitions()` (read + hash + upload all files at startup) with a two-phase lazy approach:

1. **`buildIndex(dirs)`** — recursive readdir only, builds `Map<name, {path, type}>`. No file reads, no uploads.
2. **`ensureDefinition(hash, name?)`** — on cache miss, lookup `name` in index, read file, hash, PUT. Fire-and-forget.

The call site in `index.ts` extracts `name` from event fields (agent or skill) and passes it alongside the hash.

## Architecture Decisions

| Option | Tradeoff | Decision |
|--------|----------|----------|
| Index as `Map<name, {path, type}>` vs `Map<name, string>` | Stores type too — avoids re-deriving from path at upload time | `Map<name, {path, type}>` |
| Keep `scanDefinitions` signature vs rename to `buildIndex` | Rename signals the semantic change; existing callers are internal | Rename to `buildIndex` |
| Pass name as required vs optional param | Optional preserves hash-only guard for nameless events | Optional `name?: string` |
| Fire-and-forget with `void` vs `await` | Already the pattern at call site; PUT is fast for small files | `void` (no await) |

## Data Flow

    ┌─────────────────────────────────────────────────────────────┐
    │ STARTUP                                                     │
    │                                                             │
    │  buildIndex(dirs)                                           │
    │    ├─ readdirSync each dir recursively                      │
    │    ├─ build Map<name, {path, type}>                         │
    │    └─ log definition count                                  │
    │                                                             │
    │  (NO file reads, NO uploads)                                │
    └─────────────────────────────────────────────────────────────┘

    ┌─────────────────────────────────────────────────────────────┐
    │ ON EVENT                                                    │
    │                                                             │
    │  enqueueEvent(fields)                                       │
    │    ├─ extract name from event (skill.name || agent.name)    │
    │    ├─ call ensureDefinition(hash, name)                     │
    │    └─ continue with event delivery (void, non-blocking)     │
    │                                                             │
    │  ensureDefinition(hash, name)                               │
    │    ├─ cache hit? → return (no-op)                           │
    │    ├─ cache miss + name in index?                           │
    │    │    ├─ readFile(index.get(name).path)                   │
    │    │    ├─ computeHash(content)                             │
    │    │    ├─ putDefinition({hash, name, type, content, path}) │
    │    │    └─ cache hash                                       │
    │    └─ cache miss + name NOT in index?                       │
    │         ├─ cache hash (hash-only guard)                     │
    │         └─ log warning                                      │
    └─────────────────────────────────────────────────────────────┘

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `packages/opencode-collector/src/infra/definition-uploader.ts` | Modify | Replace `scanDefinitions` with `buildIndex`, rewrite `ensureDefinition` with lazy upload logic |
| `packages/opencode-collector/src/index.ts` | Modify | Call `buildIndex` instead of `scanDefinitions`, extract and pass name to `ensureDefinition` |
| `packages/opencode-collector/src/__tests__/definition-uploader.test.ts` | Modify | Update tests: index-only scan, lazy upload on cache miss, hash-only fallback |

## Interfaces / Contracts

```typescript
// definition-uploader.ts — updated interface
export interface DefinitionUploader {
  buildIndex(dirs: string[]): Promise<number>; // returns definition count
  ensureDefinition(hash: string, name?: string): Promise<void>;
  uploadedHashes: Set<string>;
}

// index.ts — name extraction from event
// Skill events: event.skill?.name
// Agent events: event.agent?.name
// Fallback: undefined (hash-only guard applies)
```

No changes to `DefinitionPayload` or the PUT endpoint contract.

## Error Handling

| Scenario | Behavior |
|----------|----------|
| Index empty (no dirs found) | `buildIndex` returns 0, logs info. `ensureDefinition` always falls to hash-only guard. |
| Name not in index | `ensureDefinition` caches hash, logs warning, no upload. |
| File not found at indexed path | `ensureDefinition` catches error, logs warning, caches hash to prevent retry loops. |
| Hash mismatch (file changed since indexing) | Hash computed from read content won't match event hash — different code path, no conflict. |
| PUT fails | Hash NOT cached — allows retry on next event. Follows existing retry pattern in `http-client.ts`. |

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | `buildIndex` populates index without file reads | Mock `readdir`, assert `readFile` never called, assert index populated |
| Unit | `ensureDefinition` uploads on cache miss with name in index | Mock `readFile` + `putDefinition`, assert PUT called with correct payload |
| Unit | `ensureDefinition` skips upload on cache hit | Pre-populate `uploadedHashes`, assert no file read |
| Unit | `ensureDefinition` falls back to hash-only guard when name missing | Call with `undefined` name, assert hash cached, no PUT |
| Unit | `ensureDefinition` handles file not found gracefully | Mock `readFile` to throw, assert warning logged, hash cached |
| Integration | Startup path calls `buildIndex` not `scanDefinitions` | Verify startup log reports definition count |

## Threat Matrix

N/A — no routing, shell, subprocess, VCS/PR automation, executable-file classification, or process-integration boundary.

## Migration / Rollout

No migration required. The change is backward-compatible:
- `scanDefinitions` → `buildIndex` is internal to the package
- `ensureDefinition` gains an optional parameter — existing callers without name still work
- No DB, no external API changes, no config flags

Rollback: revert git commit. `scanDefinitions` and `ensureDefinition` signatures remain compatible.

## Open Questions

None — the design is straightforward and self-contained.
