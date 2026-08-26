# Design: Bootstrap Monorepo Scaffold + Canonical UsageEvent Schema

## Technical Approach

Greenfield bootstrap in one change: npm-workspaces skeleton (6 packages), shared strict toolchain at root, pure-domain `@agent-analytics/event-schema` (zod v4 single source of truth), git history starting with exactly one conventional commit. Implements specs `monorepo-scaffold` + `usage-event-schema` verbatim; tooling informed by exploration Q6.

## Architecture Decisions

| # | Decision | Options considered | Choice | Rationale |
|---|----------|-------------------|--------|-----------|
| D1 | Workspace manager | npm workspaces / pnpm / turborepo | **npm workspaces** | Built into Node ≥20, zero new tooling for 6 workspaces; pnpm/turbo deferred |
| D2 | Cross-package typing | composite project refs (`tsc -b`) / root aggregate typecheck + source exports / path aliases | **Root `tsconfig.json` aggregates all six `src/**`; each package exposes `"main"/"types": "./src/index.ts"`** | Aliases banned by spec. EMPIRICALLY VALIDATED in sandbox: workspace-name import resolves to source through the symlink; strict errors surface from root. Composite/-b needs a build story that doesn't exist yet — deferred to C3/C4 (conscious supersede of proposal wording "TS project references") |
| D3 | module resolution | `bundler` vs `node16` | **`module: "Node16"`, `moduleResolution: "node16"`** | Runtime truth is Node 20 CJS (API/collector-host); honors `exports`, catches what bundler hides; Jest transforms are CJS-friendly. Dashboard may override locally in C4. Verified pairing rule: `module:"Node16"` required with `resolution:"node16"` |
| D4 | TypeScript version | `latest` (7.0 native) vs 5.x | **`~5.9`** | TS 7.0.2 is now `latest` but Jest/@swc ecosystem is proven on 5.x; upgrade tracked later |
| D5 | Strict flags | minimal strict / strict+extras | **`strict`, `noUncheckedIndexedAccess`, `target: ES2022`** | Both mandated by spec; sandbox-verified flag fires on unsafe index access |
| D6 | Lint | per-package configs / single flat config | **Root `eslint.config.js` (typescript-eslint, flat)**; `@typescript-eslint/no-explicit-any: "error"` explicit | Flat config cascades over workspaces — nothing to duplicate, satisfying "extend shared" trivially |
| D7 | Formatting | format openspec docs too / ignore them | **`.prettierrc.json`** (semi, singleQuote, printWidth 100, trailingComma all); `.prettierignore`: dist, coverage, `openspec/**` | `prettier --check .` must exit 0 on pristine scaffold without churning SDD pipeline artifacts |
| D8 | Test runner transform | ts-jest / @swc/jest | **@swc/jest** via root `jest.preset.js` | Transpile-only speed; separation of concerns — tsc owns types, swc owns transpile. Per-package `jest.config.js` spreads the preset |
| D9 | UUIDv7 validation | zod v3 `z.string().uuid()` + regex refine / zod v4 native | **zod `^4.4.0`, native `z.uuidv7()`** | Verified: v4 ships version-checked RFC 9562 validators; zero custom regex to maintain |
| D10 | Key-set enforcement | `.strict()` top + strip nested / v4 idioms | **Top-level `z.strictObject` (unknown key ⇒ reject); every group nested `z.looseObject` (unknown nested keys tolerated)** | Maps 1:1 to Backward Compatibility requirement: nested additions non-breaking, top-level addition breaking/major-bump |

## Package Topology

```
@agent-analytics/shared            ← depends on nothing
@agent-analytics/event-schema      ← zod only (pure-domain)
@agent-analytics/opencode-collector→ { event-schema, shared }
@agent-analytics/database          → { shared }
@agent-analytics/api               → { event-schema, shared }
@agent-analytics/dashboard         → { shared }
```

Skeleton contents (each): `package.json` (private, `main/types: ./src/index.ts`), `tsconfig.json` extending base, `src/index.ts` exporting a named const + trivial function, one passing placeholder test. `apps/api` imports `event-schema` + `shared` to prove workspace-name resolution under tsc. No feature code anywhere.

## event-schema Internals

```
packages/event-schema/src/
├── ids.ts        // UuidV7Schema = z.uuidv7()
├── schemas.ts    // 10 group schemas (looseObject) + usageEventSchema (strictObject)
│                 // + inferred UsageEvent, EventStatus
├── normalize.ts  // pure helpers below
├── index.ts      // public barrel
└── __tests__/{schemas,helpers,compat}.test.ts
```

```ts
type EventStatus = 'success' | 'error' | 'cancelled';
function resolveStatus(error?: { name?: string } | null): EventStatus;          // null/undefined→success; name==='MessageAbortedError'→cancelled; else error
function resolveDefinitionVersion(...candidates: (string | undefined | null)[]): string; // first defined ?? 'unknown'
function builtinDefinitionHash(name: string): `builtin:${string}`;              // never null/undefined/empty
function extractTokenMetrics(t?: OpenCodeTokensShape): TokenMetrics;            // structural input type defined in-package — no SDK import
```

## Sequence Diagram — example event through parse + normalize

```
Collector(C2)     usageEventSchema          normalize helpers        API consumer
     │  raw event       │                          │                      │
     ├─────────────────►│ safeParse                │                      │
     │                  ├─ unknown TOP-LEVEL key ─►✖ reject (strictObject)│
     │                  ├─ missing result.status ─►✖ reject w/ path      │
     │                  ├─ ok ─────────────────────┐                      │
     │                  │                          ├ resolveStatus(err)   │
     │                  │                          ├ extractTokenMetrics  │
     │                  │◄── typed UsageEvent ◄────┘─────────────────────►│
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `.gitignore`, `package.json` (root), `package-lock.json` | Create | Ignore generated output; declare six workspaces |
| `tsconfig.base.json`, `tsconfig.json` | Create | Shared strict flags; root aggregate noEmit checker (D2/D3/D5) |
| `eslint.config.js`, `.prettierrc.json`, `.prettierignore`, `jest.preset.js` | Create | Shared toolchain (D6–D8) |
| `apps/{api,dashboard}/`, `packages/{opencode-collector,event-schema,database,shared}/` | Create | Skeletons per topology above |
| `packages/event-schema/src/**` | Create | Schema + helpers + tests per internals above |
| Initial git commit | Create | Single conventional commit incl. existing `openspec/` |

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit (event-schema) | Every spec scenario: accept/reject (unknown top-level key, missing `result.status`, bad UUIDv7, string `cost`), ladder, sentinel, mapping table, purity (double-call deep-equal + input unmutated), newer-producer/older-consumer nested tolerance | Jest via shared preset; one `describe` per requirement |
| Integration | None — package has no I/O by design | N/A |
| Scaffold E2E | Four root commands exit 0 on pristine tree; violation fails loudly; `git status --porcelain` clean after install/test runs; exactly one conventional commit | Manual/scripted apply-phase verification |

## Threat Matrix

N/A — no routing, shell, subprocess, VCS automation, executable-file classification, or process-integration boundary. Git operations are one-shot apply steps, not designed runtime behavior.

## Git Bootstrap Procedure

1. Write `.gitignore` FIRST (`node_modules/`, `dist/`, `coverage/`, `.env*`, `*.tsbuildinfo`, `.DS_Store`).
2. Write all files → `npm install` (lockfile committed) → run four root commands until green.
3. `git init && git add -A && git commit -m "feat: bootstrap monorepo scaffold and canonical UsageEvent schema"` — existing `openspec/` is repo truth and rides in the same initial commit; ignored paths keep porcelain clean.

## Explicitly Deferred (apply MUST NOT creep)

Collector plugin · API server/Fastify · database/Kysely/migrations · dashboard UI/Vite/React · CI · Docker · pnpm/turborepo · coverage thresholds · composite builds (`tsc -b`) · OpenCode SDK dependency · API-key infra.

## Migration / Rollout

No migration required. Greenfield: rollback = delete branch or reset to pre-change empty state; removing skeletons + root configs removes all surface.

## Open Questions

None blocking.
