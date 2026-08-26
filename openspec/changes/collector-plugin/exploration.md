# Exploration: collector-plugin (C2)

Date: 2026-08-26 · Phase: sdd-explore · Store: openspec · Review budget: 400 lines/slice
Sources: official docs opencode.ai/docs/plugins + /docs/config + /docs/skills (all "Last updated: Aug 26, 2026"), npm registry manifests (`@opencode-ai/plugin@1.18.23`, `opencode-wakatime@1.3.9`), repo state @ main `6eca49a`.
Inherits from archived C1 exploration (cited, not re-researched): hook surface, `message.updated` AssistantMessage payload, ToolPart states, `session.created` parentID tree, `vcs.branch.updated`, coverage matrix, hashing/version ladder, builtin sentinel.

## Current State

C1 archived. Repo has npm workspaces + TS strict + Jest/@swc/jest + eslint flat. `packages/event-schema` implements the canonical contract: closed top-level key set (`id, actor, project, session, execution, agent, skill, tool, model, metrics, result`), nested groups are `looseObject`, plus pure helpers ready for reuse by the mappers — `resolveStatus(error)`, `resolveDefinitionVersion(...)`, `builtinDefinitionHash(name)`, `extractTokenMetrics(tokens)`. `packages/opencode-collector` is an empty skeleton (`main: ./src/index.ts`, deps: event-schema + shared). Note the schema leaves `project`, `session`, `tool`, `model` as empty loose objects — v1 mapper field choices there are additive (non-breaking) but should be pinned in the delta spec.

## Gap 1 — Plugin packaging & installation mechanics: VERIFIED

| Route | Mechanism | Notes |
|---|---|---|
| Project local | drop `.ts`/`.js` in `.opencode/plugins/` | auto-loaded at startup; no manifest needed |
| Global local | `~/.config/opencode/plugins/` | same |
| npm package | `"plugin": ["name", "@scope/name"]` in `opencode.json` | regular + scoped supported |
| Custom dir | `OPENCODE_CONFIG_DIR` env var | searched like `.opencode/`; **testing lever** |

Verified facts:
- **TS executes directly** — OpenCode runs on Bun; docs show raw `.ts` plugins with no build step. Local plugins load straight from source.
- **npm plugins** are installed automatically **using Bun at startup**, cached in `~/.cache/opencode/node_modules/`. Community convention (`opencode-wakatime@1.3.9` manifest): ship compiled/bundled ESM (`exports → dist/index.js`) with `@opencode-ai/plugin` as **peerDependency ≥1.0.0**.
- **Signature**: module exports one or more async named functions receiving `{ project, client, $, directory, worktree }`, returning the hooks object. Types via `import type { Plugin } from "@opencode-ai/plugin"` — types-only ⇒ **zero runtime dependency** on that package.
- **Load order**: global config → project config → global dir → project dir; same name+version deduped; all hooks run in sequence alongside other plugins.
- Local plugins wanting bare-specifier imports need a `.opencode/package.json` (OpenCode runs `bun install` at startup).
- Logging: `client.app.log({ body: { service, level, message, extra } })` — use instead of console.log (feeds the startup self-check required by C1 risk #2).

Consequence for repo layout: **v1 ships TS source, no build step.** Bun resolves `main: ./src/index.ts` fine when the consumer project can see our workspace (dogfooding in this monorepo via a thin shim file in `.opencode/plugins/analytics.ts`: `export { AgentAnalyticsPlugin } from "<relative path>/packages/opencode-collector/src/index.ts"`). For future public distribution add a build producing a single-file bundled ESM in `dist/` (esbuild or tsc-only since runtime deps are just zod+schema, both bundleable) — deferred, NOT part of C2. Version pinning for the npm route: docs show bare names only; whether `name@range` specifiers are accepted is undocumented → document exact-pin example and verify during B3 smoke test (minor uncertainty).

## Gap 2 — Config surface

`opencode.json` supports `{env:VAR}` substitution but the `plugin` key carries only package names — there is NO documented pass-through of custom options into plugin init context. So the collector must self-configure. Recommended layered resolution (first hit wins):

1. Env vars: `OPENCODE_ANALYTICS_USER` (required for events to flow), `OPENCODE_ANALYTICS_URL`, `OPENCODE_ANALYTICS_API_KEY`, optional `OPENCODE_ANALYTICS_DISABLED=true` kill-switch.
2. JSON file `.opencode/analytics.json` — already established in C1 as the definition-version manifest; extend with a `"collector": { url, apiKey?, privacy: { prompts, responses, toolArguments } }` section (single file, one mental model, matches Q2 ladder).
3. Pure defaults in domain code: privacy flags **default false** (prompts/responses/toolArguments captured only on explicit opt-in).

Where defaults live so domain stays pure: a `config-schema.ts` (zod schema + `DEFAULTS` const) in the collector's domain layer with zero I/O; reading env/file happens in the bootstrap adapter (`index.ts` wiring), which parses through the zod schema and injects a frozen `CollectorConfig` into the plugin closure. Mappers/buffer/client receive config values, never read `process.env`.

## Gap 3 — Hook→UsageEvent mapping table (design-critical)

Base facts inherited from C1 exploration (AssistantMessage fields, ToolState shapes, session tree); new verifications from today's docs: **skill invocation = native `skill` tool called as `skill({ name })`** (skills doc shows exact invocation shape) ⇒ observable via `tool.execute.before` with `input.tool === 'skill'`, args `{ name: string }`; permission model confirms `skill` is a first-class tool name.

| Trigger (hook/event) | UsageEvent emitted | Field mapping |
|---|---|---|
| `event` → `session.created` (root: no parentID) | agent-execution START marker | buffer execution context: `execution.traceId = session.id`; `project.directory`, `session.id`, `project.branch` (via later `vcs.branch.updated`) staged here; agent resolved from first UserMessage of session |
| `event` → `session.created` (child: parentID set) | subagent execution start | same as root PLUS `execution.parentId = info.parentID`; `traceId` stays ROOT session id (roll-up rule from C1 risk #6, pin in spec) |
| `chat.message` (user msg) | prompt-length evidence | actor prompt length/hash behind `privacy.prompts` (default false ⇒ emit length only, never content) |
| `tool.execute.before` | tool-call OPEN (buffered) | `tool.callID = input.callID`; if `input.tool === 'skill'` ⇒ SKILL event seeded with `skill.name = output.args.name`; other tools stage `tool.name`; args hashed only if `privacy.toolArguments` true (default false) |
| `tool.execute.after` | closes tool call | correlate via `callID`; duration from paired timestamps |
| `event` → `message.part.updated` (ToolPart completed/error) | TOOL event final form (preferred over after-hook: carries `state.time.{start,end}`, `state.output`, `state.error`) | `metrics.durationMs = end−start`; `result.status = error-state ? 'error' : 'success'`; MCP tools keep full name (`mcp_server_tool`) per C1 |
| `event` → `message.updated` (AssistantMessage) | MODEL-CALL event | `model.provider = providerID`, `model.name = modelID`; `metrics.inputTokens/outputTokens/cachedTokens(cache.read)/cost` via existing `extractTokenMetrics`; `metrics.durationMs = time.completed − time.created`; `result.status = resolveStatus(msg.error)` (existing helper); `agent.name` attribution per message's session+agent context |
| `skill` ToolPart completion | SKILL event close | `skill.definitionHash`/`version` via C1 ladder helpers (`resolveDefinitionVersion`, `builtinDefinitionHash`) |
| `event` → `session.error` | failure tracking | enrich open executions with `result.status='error'` context |
| `event` → `session.idle` | flush trigger + reconciliation pass | `client.session.messages()` backfill for late/final metrics (cost finalized at assistant completion) then enqueue pending events |
| `dispose` | FINAL flush | drain buffer synchronously-best-effort |

Uncertainties still open (each with mitigation):
- **StepFinishPart availability/ordering**: not re-verifiable without running OpenCode; treat as OPTIONAL enrichment only — metrics come primarily from `message.updated` AssistantMessage (verified payload). Mitigation: reconciliation pass at `session.idle` via `client.session.messages()`.
- **`message.part.updated` ordering guarantees**: none documented ⇒ mappers stay STATELESS per key (last-write-wins keyed by `callID`/message id; each part carries full state) and truth is finalized at idle-flush reconciliation.
- **Exact arg names in `tool.execute.after` result object** (docs show `(input, output)` for before; after-shape assumed symmetric): mitigate with tolerant mapper + one-time debug log of unseen shapes (drop-with-counter, never crash).
- **Subagent cost roll-up rule** (child assistant messages attributed to invoking execution): policy decision, pin in spec phase (carried from C1 risk #6).
- **npm route version specifier support**: pin exact versions in docs; verify in smoke test.

## Gap 4 — Testing strategy (side-effecting plugin)

Options considered:

| Approach | Pros | Cons | Effort |
|---|---|---|---|
| A. Pure mapper unit tests (payload fixtures → UsageEvent) | deterministic, fast, drift-fix-is-one-file | doesn't prove wiring | Low |
| B. Buffer/retry unit tests: fake timers + injected fetch (stub `globalThis.fetch`) | proves flush/backoff/drop logic without network | mocks, not real HTTP | Low-Med |
| C. Integration smoke: spawn headless `opencode run` with `OPENCODE_CONFIG_DIR` pointing at fixture dir whose shim posts to a local mock HTTP server (node:http in test) | proves REAL hook dispatch end-to-end | requires opencode binary installed; slow; flaky-prone | Med |

**Recommendation: A + B mandatory, C minimal-and-skippable.** One smoke test file guarded by binary-presence detection (`describe.skipIf(!hasOpencode)`), asserting ≥1 batch received by the mock server for a trivial prompt. This is the minimal credible set: A pins payload-drift contracts, B proves delivery semantics, C proves OpenCode actually loads us (the silent-unknown-hooks failure mode from C1 risks makes C worth its cost, but it must never block CI on machines without the binary).

## Gap 5 — HTTP batching client: boring default recommended

**Plain global fetch** (native in Node ≥18 / Bun) + `AbortController` per-request timeout. No axios/got/undici dep — the plugin runs under Bun where fetch is native; a dep would only bloat the future bundle. Flush policy (per product brief, matches C1 Q4 contract):
- Enqueue is fire-and-forget (never blocks hooks).
- Flush when: queue ≥ 100 events OR 1s timer elapses OR `session.idle` OR `dispose`.
- Bounded queue: 10k events; overflow drops OLDEST, increments internal drop counter (surfaced via periodic `client.app.log` heartbeat).
- Retry: exponential backoff + jitter on 5xx/network/abort-timeout; max ~5 attempts then drop batch WITH counter increment. v1: no disk spill.
- Retries safe by design: server dedupes on client-generated UUIDv7 `id` (ingest contract verified in C1 Q4).
- POST `/v1/events/batch` with `X-API-Key` header; body `{ events: UsageEvent[] }`; validate against `usageEventSchema` before enqueue (fail-fast on mapper drift, log+drop invalid rather than poison batches).

## Gap 6 — Slice plan (≤400 lines review budget each)

Dependency order B1′ ← B2′ ← B3′; each independently mergeable to main (stacked per session strategy ask-on-risk):

1. **B1′ `mapper layer + fixtures tests`** (no OpenCode dep beyond fixture payloads)
   - `src/mappers/session-mapper.ts` (~40) · `message-mapper.ts` (~70) · `tool-skill-mapper.ts` (~60) · glue/context types (~30)
   - Reuse event-schema helpers (status/tokens/version/sentinel) — zero duplication
   - `src/fixtures/opencode-payloads.ts` typed fixture payloads (~120) · `__tests__/mappers.test.ts` (~150)
   - Estimate: **~420–470 lines** → `400-line budget risk: Medium`; if forecast >450 at tasks phase, split fixtures+edge-tests into B1″
2. **B2′ `buffer + http client + config`**
   - `src/domain/config-schema.ts` zod + DEFAULTS, pure (~60) · `src/infra/event-buffer.ts` bounded queue/flush triggers (~110) · `src/infra/http-client.ts` fetch+AbortController+backoff (~90)
   - Tests: fake timers + injected fetch covering flush thresholds, drop-oldest counter, retry-then-drop (~180)
   - Estimate: **~440 lines** → `400-line budget risk: Medium`
3. **B3′ `wiring + docs + smoke`**
   - `src/index.ts` plugin entry: hook registration → mappers → buffer, startup self-check log (~120) · README install/config/privacy section (~80) · skippable integration smoke (~90) · shim template snippet in docs (~20)
   - Estimate: **~310 lines** → `400-line budget risk: Low`

Forecast totals ≈ 1,170–1,220 changed lines across 3 slices. `Decision needed before apply: No` (strategy cached: ask-on-risk, stacked-to-main) · `Chained PRs recommended: Yes` (3 slices above) · overall budget risk: **Medium** (B1′/B2′ near ceiling).

## Approaches (packaging decision, summarized)

1. **Ship TS source, local-file install (recommended for C2)** — Bun executes TS directly; zero build tooling; dogfood via shim in this monorepo. Pros: no build step, fastest loop, matches docs. Cons: public consumers need npm route later. Effort: Low.
2. **Build+bundle dist now (wakatime-style)** — esbuild single-file ESM. Pros: publish-ready immediately. Cons: extra dep + pipeline for a private v1 nobody installs from npm yet. Effort: Med.
3. **Compiled tsc dist only** — middle ground. Cons: multi-file dist still needs node_modules resolution by end users (needs `.opencode/package.json` + registry deps we don't publish). Effort: Med. Not coherent pre-publish.

## Recommendation

Proceed to proposal with: TS-source-first packaging (Approach 1) + shim install documented for v1; layered env→JSON→pure-defaults config with privacy flags default-false living in a pure domain config schema; mapping table above pinned into the delta spec including the roll-up rule and the four flagged uncertainties as explicit non-goals/mitigations; test tiers A+B mandatory + C skippable; plain-fetch buffering client per Gap 5. Slice as B1′→B2′→B3′.

## Risks

- Payload drift (StepFinishPart, after-hook shape, part ordering) — mitigated by stateless last-write-wins mappers + idle reconciliation + table-driven fixtures (drift fix = one file + one fixture).
- Silent unknown-hook failures — mitigated by startup self-check via `client.app.log` heartbeat (B3′).
- B1′/B2′ hover near the 400-line ceiling — sdd-tasks MUST re-forecast and split if >450.
- Integration smoke depends on locally installed `opencode` binary — skipIf guard keeps CI green; restart requirement after plugin install must be documented (stale-process gotcha from C1).
- npm-route version pinning undocumented — exact-pin guidance until smoke test verifies range syntax.

## Ready for Proposal

YES — run sdd-propose for change `collector-plugin` with the scope above; carry the Gap-3 table and roll-up rule into spec requirements verbatim.
