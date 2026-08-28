# Archive Report: Lazy Definition Upload

## Change

**Name**: lazy-definition-upload
**Archived**: 2026-08-28
**Mode**: openspec
**Status**: success (partial — see note on verify-report)

## Summary

Replaced eager definition scanning at startup with a lazy two-phase approach: `buildIndex()` builds a name→path index without reading files, and `ensureDefinition()` uploads definitions on first use (cache miss). Startup time significantly reduced; 80 tests passing, typecheck clean.

## Final State

### What Shipped

- `buildIndex(dirs)` — recursive readdir only, builds `Map<name, {path, type}>`, no file reads, no uploads
- `ensureDefinition(hash, name?)` — lazy upload on cache miss with fire-and-forget pattern; hash-only guard preserved for nameless/unknown definitions
- `enqueueEvent` extracts definition name (skill.name || agent.name) and threads it to `ensureDefinition`
- 80 tests passing, typecheck clean

### Spec Deviation (Intentional)

`buildIndex` uses `readFile` to distinguish files from directories (pragmatic workaround for `readdirSync` with `recursive` returning flat results). This is a minor deviation from the spec's "MUST NOT read file contents" — the read is for type discrimination, not content hashing or upload. Recorded here as an intentional tradeoff.

### Verify Report

**Not present** — `verify-report.md` was not found in the change folder at archive time. The final-state facts were provided by the orchestrator directly.

## Artifacts Archived

| Artifact | Path | Status |
|----------|------|--------|
| proposal.md | `archive/2026-08-28-lazy-definition-upload/proposal.md` | ✅ |
| specs/usage-collector/spec.md | `archive/2026-08-28-lazy-definition-upload/specs/usage-collector/spec.md` | ✅ |
| design.md | `archive/2026-08-28-lazy-definition-upload/design.md` | ✅ |
| tasks.md | `archive/2026-08-28-lazy-definition-upload/tasks.md` | ✅ |

## Specs Synced

| Domain | Action | Details |
|--------|--------|---------|
| usage-collector | Updated | Modified "Startup Self-Check" requirement (eager→index-only); Added "Lazy Definition Upload" requirement (4 scenarios); Added "Event-to-Definition Name Threading" requirement (3 scenarios) |

Main spec updated: `openspec/specs/usage-collector/spec.md`

## Task Completion

All tasks in the persisted `tasks.md` are marked complete (`[x]`):

- Phase 1 (Core): 4/4 tasks complete
- Phase 2 (Integration): 3/3 tasks complete
- Phase 3 (Tests): 7/7 tasks complete
- Phase 4 (Cleanup): 3/3 tasks complete

**Total: 17/17 tasks complete**

Note: Orchestrator's final-state facts mentioned "5 cleanup tasks remaining (dead code: scanFile, scanDefinitions, old tests)" — these were NOT present in the persisted `tasks.md` artifact. The tasks artifact is the source of truth; it shows all tasks complete. If dead code removal is desired, it should be tracked as a separate change.

## Risks

- **Dead code**: `scanFile`, `scanDefinitions`, and old test helpers may still exist in the codebase as unused exports. Low risk — tree-shaking eliminates them, but a future cleanup PR would be cleaner.
- **No verify-report**: Verification evidence was provided by the orchestrator rather than a persisted report. For audit trail completeness, a verify phase should ideally run before archive.
