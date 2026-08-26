# Tasks: Bootstrap Monorepo Scaffold + Canonical UsageEvent Schema

Legend: `ms:`/`ue:` = delta-spec requirement/scenario refs; `D#` = design decisions.

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | Total ~770 (range 710–830): Slice A ~320 · B1 ~265 · B2 ~185 — bottom-up exceeds proposal's ~450 trigger → contingency split active |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR1=A configs+workspaces · PR2=B1 schema contract+tests · PR3=B2 helpers+tests |
| Delivery strategy | ask-on-risk |
| Chain strategy | pending |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: pending
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|------|------|-----------|----------------------|-----------------|-------------------|
| A | Shared toolchain + 6 skeletons + `.gitignore` | PR 1 | `npx tsc --noEmit && npx eslint .` | N/A — static scaffold, no runtime behavior | Delete root configs + skeleton dirs |
| B1 | Zod UsageEvent contract + schema tests | PR 2 | `npx jest schemas` | N/A — pure-domain units, zero I/O (design Testing Strategy) | Revert `packages/event-schema/src/*` + schema test |
| B2 | Helpers + helper/compat tests | PR 3 (base=PR2 branch if chained) | `npx jest helpers compat` | N/A — pure functions | Revert `normalize.ts` + its two test files |

## Phase 1: Repo Bootstrap Configs (slice A)

- [x] 1.1 Create `.gitignore` FIRST: `node_modules/ dist/ coverage/ .env* *.tsbuildinfo .DS_Store`. AC: design bootstrap step 1; ms:untracked-generated precondition.
- [x] 1.2 Root `package.json`: workspaces = exactly the six paths; scripts per `config.yaml planned_commands`; devDeps TS ~5.9 (D4), typescript-eslint flat, prettier, jest, @swc/core+jest, @types/jest. AC: ms:workspace-resolution declaration.
- [x] 1.3 `tsconfig.base.json`: strict, `noUncheckedIndexedAccess`, target ES2022, module/moduleResolution Node16 (D3/D5) + root aggregate `tsconfig.json`: noEmit checker spanning all six `src/**` trees (D2 — implements DESIGN mechanism, superseding stale proposal "project references" wording). AC: ms:strictness basis.
- [x] 1.4 `eslint.config.js` flat, `no-explicit-any: "error"` (D6); `.prettierrc.json` + `.prettierignore` (`dist/`, `coverage/`, `openspec/**`) (D7); `jest.preset.js` via @swc/jest (D8). AC: ms:single-shared-config-source.

## Phase 2: Workspace Skeletons (slice A)

- [x] 2.1 Skeletons `shared`, `event-schema` (runtime dep `zod ^4.4.0`, D9): private `package.json` with `main/types: ./src/index.ts`; `tsconfig.json` extends base; trivial `src/index.ts`; one passing placeholder test; NO feature code. AC: ms:skeleton-integrity.
- [x] 2.2 Remaining skeletons, same shape: `database`(→shared), `opencode-collector`(→event-schema,shared), `dashboard`(→shared), `api`(→event-schema,shared; its `src/index.ts` imports both by `@agent-analytics/*` name). AC: ms:workspace-named-import.
- [x] 2.3 Run `npm install`; verify lockfile created and all six names resolve via workspace links from sibling packages. AC: ms:workspace-resolution-from-root.

## Phase 3: UsageEvent Contract Source (slice B1)

- [ ] 3.1 `src/ids.ts`: `UuidV7Schema = z.uuidv7()` native validator (D9). AC: ue:id-rule.
- [ ] 3.2 `src/schemas.ts`: ten group schemas as `z.looseObject` (actor…result); `usageEventSchema = z.strictObject` allowing EXACTLY `id` + the ten groups (D10); exported `UsageEvent`/`EventStatus` inferred from schema (no hand-maintained duplicate); enforce spec field table (traceId+userId+name required; parentId/version?/definitionHash? optional; metrics optional numbers; status enum success|error|cancelled); pure-domain — sole dep zod, no I/O. Public barrel in `src/index.ts`. AC: ue:minimal-accepted, ue:unknown-top-key, ue:missing-field.
- [ ] 3.3 `__tests__/schemas.test.ts`: full valid fixture round-trips; unknown top-level key rejected and named; missing `result.status` reports that path; bad UUIDv7 + string `cost` rejected; valid UUIDv7 + traceId=root session without parentId accepted. AC: ue:Contract×3 + ue:Fields×2.

## Phase 4: Pure Helpers + Remaining Tests (slice B2)

- [ ] 4.1 `src/normalize.ts` per design signatures: `resolveStatus` (null/undefined→success; MessageAbortedError→cancelled; any other error→error); `resolveDefinitionVersion` (first defined candidate ?? `'unknown'`); `builtinDefinitionHash(name)` → `` `builtin:${name}` ``, never null/empty; `extractTokenMetrics` over in-package structural token shape (no SDK import). All deterministic, side-effect-free, non-mutating. AC: ue:ladder/sentinel/mapping/purity definitions.
- [ ] 4.2 `__tests__/helpers.test.ts`: ladder explicit→value else `'unknown'`; sentinel yields exactly `builtin:explore`; mapping table undefined/MessageAbortedError/ProviderAuthError/SomeNewError→success/cancelled/error/error; purity double-call deep-equal + input unchanged. AC: those four ue scenarios.
- [ ] 4.3 `__tests__/compat.test.ts`: future-collector extra nested key tolerated; hypothetical new top-level key rejected confirming major-bump gate. AC: ue:backward-compat×2.

## Phase 5: Verification + Single Initial Commit

- [ ] 5.1 From pristine tree, all four root commands exit 0: `tsc --noEmit`, `eslint .`, `prettier --check .`, `jest`. AC: ms:four-commands-pass.
- [ ] 5.2 Negative controls (temp files, removed after): implicit-`any` + unchecked-index source fails typecheck; lint/format violation exits non-zero naming file. AC: ms:violation-fails-loudly + ms:strictness-enforced.
- [ ] 5.3 Verify zero deferred-capability modules exist (collector plugin, API server, DB, dashboard, CI, Docker). AC: ms:skeleton-integrity clause.
- [ ] 5.4 ~~`git init` → add -A → exactly ONE conventional commit `feat: bootstrap monorepo scaffold and canonical UsageEvent schema`~~ **SUPERSEDED BY APPROVED CHAINED SPLIT** (maintainer-approved, stacked-to-main): PR1 squash-merges so main's history BEGINS with exactly ONE conventional scaffold commit `feat: bootstrap monorepo scaffold`; canonical UsageEvent lands in later PR commits (B1/B2). Existing `openspec/` rides along tracked. AC: ms:one-clean-commit + ms:untracked-generated — satisfied via squash-merge of PR1.

## Traceability Matrix (scenario → task ids)

- ms: workspace-resolution 2.3 · workspace-import 2.2,5.1 · strictness-enforced 1.3,5.2 · shared-config-source 1.4,2.1–2.2 · four-pass 5.1 · violation-fails 5.2 · skeleton-integrity 2.1–2.2,5.1,5.3 · one-commit 5.4 · untracked-generated 1.1,5.4
- ue: minimal-accepted 3.2,3.3 · unknown-top-key 3.2,3.3,4.3 · missing-field 3.3 · additions-validated 3.3 · malformed-identity 3.3 · ladder 4.1,4.2 · sentinel 4.1,4.2 · mapping-table 4.1,4.2 · purity 4.1,4.2 · nested-tolerance 3.2,4.3 · top-level-gated 4.3 · suite-proves-contract 3.3,4.2,4.3,5.1
