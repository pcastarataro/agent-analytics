# Proposal: Bootstrap Monorepo Scaffold + Canonical Event Schema

## Why

Repo is empty except `openspec/` — no git, no toolchain, no code. Every downstream slice (collector C2, API C3, dashboard C4–C5) depends on (a) a shared strict TypeScript toolchain + workspace layout, and (b) the canonical `UsageEvent` contract that is the single integration point between collector and API. Locking the schema now, while OpenCode payload findings are verified fresh (official docs + SDK types, 2026-08-25; feasibility gate PASS), prevents contract drift later. Building anything else first would force rework.

## What Changes

### In Scope
1. Root tooling configs: `tsconfig.base.json` (strict + `noUncheckedIndexedAccess`), ESLint flat config, Prettier, shared Jest preset.
2. npm-workspaces monorepo skeleton: `apps/api`, `apps/dashboard`, `packages/opencode-collector`, `packages/event-schema`, `packages/database`, `packages/shared` (empty skeletons, workspace-named deps `@agent-analytics/*`).
3. `git init` + clean conventional initial commit.
4. `packages/event-schema`: canonical `UsageEvent` zod schemas + inferred types + pure normalization helpers (error-taxonomy → status mapping incl. aborted→cancelled; token extraction) + unit tests.

**Contract fidelity (binding):** UsageEvent keeps the brief's exact top-level shape — `actor/project/session/execution/agent/skill/tool/model/metrics/result`. Approved additions folded in: `id` = client-generated UUIDv7; `execution.traceId` = root session id; `actor.userId` sourced from collector env `OPENCODE_ANALYTICS_USER`; agent/skill version resolution ladder ending in sentinel hash `builtin:<name>` with version fallback `'unknown'`.

### Out of Scope
Collector plugin, API server, database/persistence, dashboard, CI, Docker — deferred to changes C2–C5.

## Capabilities

> Contract with sdd-spec. `openspec/specs/` is empty — everything here is new.

### New Capabilities
- `monorepo-scaffold`: workspaces layout, root tooling configs, Jest preset, git bootstrap.
- `usage-event-schema`: UsageEvent zod contract, inferred types, normalization helpers, version/hash sentinel rules, tests.

### Modified Capabilities
None.

## Approach

npm workspaces + TS project references; no cross-package path aliases. Schema package stays pure-domain: zod as single source of truth, types inferred, helpers pure, runtime dep limited to zod. Details deferred to design.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `/tsconfig.base.json`, `eslint.config.*`, `.prettierrc*`, `jest.preset.js` | New | Strict shared toolchain |
| `package.json` (root) | New | Workspaces definition |
| `apps/*`, `packages/*` | New | Empty package skeletons |
| `packages/event-schema/**` | New | Zod schemas, types, helpers, tests |
| `.gitignore`, initial commit | New | Repo bootstrap |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Schema drifts from product brief | Low | Binding fidelity clause above; spec-phase shape assertions + tests |
| Scaffold over-engineering | Low | Skeletons stay empty; pnpm/turborepo deferred |
| Changed-line budget overrun | Medium | Conditional PR split (see forecast); trim config extras |

## Rollback Plan

Greenfield with git from commit #1: `git reset --hard <pre-change>` (or delete branch) restores empty-repo state. Removing `packages/*` skeletons + root config files eliminates all surface area. No persisted data, no consumers, no external coupling.

## Dependencies

- Node ≥ 20 LTS, npm (workspaces built-in)
- Runtime dep: `zod`; dev deps: TypeScript, ESLint, Prettier, Jest (+ ts-jest)

## Success Criteria

- [ ] From root: `tsc --noEmit`, `eslint .`, `prettier --check .`, `jest` all pass.
- [ ] Six workspaces resolve via `@agent-analytics/*` names; project-reference typecheck works.
- [ ] Exported zod schema + inferred `UsageEvent` match brief shape exactly; UUIDv7 id, traceId, userId source, version ladder encoded.
- [ ] Status mapping covers OpenCode error taxonomy (success/error/cancelled) with passing tests; helpers are pure.
- [ ] History begins with one clean initial commit.

## Review Workload Forecast

- Estimated changed lines: ~380–480 (configs dominate; schema+tests ~200).
- Decision needed before apply: No
- Chained PRs recommended: No
- 400-line budget risk: Medium
- Contingency: if sdd-tasks forecast exceeds ~450, split chained slices — A: configs+workspaces+git; B: event-schema.
- Default (ask-on-risk): proceed autonomously; escalate only if apply uncovers real risk.

## Next Phases

sdd-spec (new specs: `monorepo-scaffold`, `usage-event-schema`) → sdd-design → sdd-tasks → sdd-apply → sdd-verify → sdd-archive.
