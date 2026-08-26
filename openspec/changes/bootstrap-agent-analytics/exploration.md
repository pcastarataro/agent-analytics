# Exploration: OpenCode Agent Analytics — bootstrap-agent-analytics

Date: 2026-08-25 · Phase: sdd-explore · Store: openspec · Sources: official docs (opencode.ai/docs/plugins, /agents, /skills, /sdk) + generated SDK types (`packages/sdk/js/src/gen/types.gen.ts` @ dev branch, verified 2026-08-25).

## Current State

Greenfield. Empty repo, only `openspec/` scaffolded by sdd-init. No git, no code, no test runner. All findings below are about the EXTERNAL system (OpenCode) the collector must hook into.

## Q1 — OpenCode plugin/event surface (feasibility gate): VERDICT = FEASIBLE

OpenCode plugins are JS/TS modules (loaded from `.opencode/plugins/` project-local or `~/.config/opencode/plugins/` global, or npm packages in `opencode.json`). Plugin init receives `{ project, client, $, directory, worktree }`; `client` is the full typed SDK client; `$` is Bun shell.

### Hook surface (direct hooks)

| Hook | Payload | UsageEvent value |
|---|---|---|
| `event` | `{ event: { type, properties } }` — ALL server events (list below) | primary capture channel |
| `tool.execute.before` | `input: { tool, sessionID, callID }`, mutable `output.args` | tool execution start; args behind privacy flag |
| `tool.execute.after` | input + result | tool completion correlation |
| `chat.message` | user message (read-only) | actor prompt length/hash |
| `chat.params` / `chat.headers` | per-LLM-call params | model verification |
| `permission.ask` | permission prompt | optional |
| `experimental.session.compacting` | compaction context | optional |
| `dispose` | on exit/reload | FLUSH TRIGGER for buffer |
| custom `tool` registration | zod-schema tools | not needed v1 |

Gotcha: unknown hook names are SILENTLY ignored; stale `opencode web` processes cache old plugin state (restart required after install).

### Event bus payload shapes (verified from types.gen.ts)

- **`message.updated`** → `info: Message = UserMessage | AssistantMessage`.
  - `AssistantMessage`: `id, sessionID, parentID, modelID, providerID, mode, agent(via UserMessage), cost: number, tokens: {input, output, reasoning, cache:{read,write}}, time: {created, completed?}, error?: {ProviderAuthError|UnknownError|MessageOutputLengthError|MessageAbortedError|ApiError}`.
  - `UserMessage`: `id, sessionID, agent: string, model:{providerID, modelID}, time.created`.
  - ⇒ FILLS: model.{provider,name}, metrics.inputTokens/outputTokens/cachedTokens(cache.read)/cost, durationMs (completed−created), result.status (error→'error', MessageAbortedError→'cancelled', else 'success'), agent name per message.
- **`message.part.updated`** → `part: Part`. Relevant part types:
  - `ToolPart { callID, tool, state: ToolState }`; `ToolState.completed { input, output, time:{start,end} }`, `ToolState.error { error, time:{start,end} }` ⇒ tool events with duration + status; `state.input` = tool arguments (privacy-gated). Tool name covers MCP tools too (`mcp_server_tool` naming).
  - `StepFinishPart { cost, tokens{...}, reason }` ⇒ per-step metrics.
  - `AgentPart { name, source }` (agent @mentions), `subtask part { agent, prompt, description }` ⇒ subagent invocation evidence.
- **`session.created`** → `info: Session { id, projectID, directory, parentID?, title, version(opencode version), time:{created,...} }`. `parentID` = SUBAGENT CHILD SESSIONS ⇒ execution tree via session tree + `session.children()` SDK call. No `agent` field on Session — resolve active agent from first UserMessage.agent of that session.
- **`session.idle`** → `{ sessionID }` ⇒ session end flush trigger.
- **`session.error`** → error taxonomy ⇒ failure tracking.
- **`vcs.branch.updated`** → `{ branch }` ⇒ project.branch.
- Others: `command.executed`, `file.edited`, `permission.updated/replied`, `installation.updated`.

### Coverage matrix vs product questions

| Question | Native? | Source |
|---|---|---|
| Who (actor.userId) | GAP | OpenCode is local-first single-user; NO native user identity. Derive from OS user/host or collector config (`OPENCODE_ANALYTICS_USER`). Multi-user = one install per user. |
| Which agents/skills used | YES | `UserMessage.agent`, AgentPart/subtask parts, `skill` ToolPart (`input.tool === 'skill'`) |
| Cost per agent | YES | `AssistantMessage.cost` summed by agent attribution |
| Models used | YES | `modelID/providerID` on messages |
| Duration | YES | message/tool/part timestamps |
| Success rates | YES | message `error` field + ToolState.error |
| Version performance | DERIVED | see Q2 (hash scheme) |
| Tools/MCPs per agent | YES | ToolParts within session |
| Execution sequence/tree | MOSTLY | ordered parts per session + Session.parentID tree |

### Backfill safety net
Plugin can also pull `client.session.messages()`, `client.session.children()`, `client.app.agents()`, `client.project.current()` — enables reconciliation and late-arriving metrics (cost is finalized when assistant message completes).

## Q2 — Definition hash + version capture

Definition locations (official docs):
- Agents: `.opencode/agents/*.md` (project, walked up to worktree root), `~/.config/opencode/agents/*.md` (global); OR JSON inside `opencode.json` under `"agent"` key. Built-in agents (build, plan, general, explore, scout, compaction, title, summary) have NO file.
- Skills: `.opencode/skills/<name>/SKILL.md` (+ `~/.config/opencode/skills/`, `.claude/skills/`, `.agents/skills/` compat paths). Frontmatter fields: name, description, license, compatibility, `metadata` (string-to-string map) — unknown fields IGNORED (safe place for version).

Hashing scheme proposal:
1. Resolve definition source at invocation time: search order global-then-project matching OpenCode's own precedence; detect whether defined in markdown file vs opencode.json vs built-in.
2. Bytes hashed = raw file bytes for md files; for JSON-defined agents = stable canonical serialization of the agent's config subtree (`JSON.stringify(sortKeys(value))`); built-ins = literal sentinel `"builtin:<name>"`.
3. `definitionHash = sha256(bytes)` hex. Same hash ⇒ identical behavior definition; edit-without-bump still yields distinct versions.
4. Version resolution ladder: skill `metadata.version` → shared manifest `.opencode/analytics.json` (`{"agents":{"review":"2.1.0"}}`) → `'unknown'` (hash remains the true identity). NOTE: do NOT put a `version` frontmatter field on agent .md files — unknown agent options are passed through to the PROVIDER as model options (documented side effect); skills metadata map is safe.

## Q3 — Dual-engine persistence

| Approach | Pros | Cons | Complexity |
|---|---|---|---|
| Raw dialect-split SQL repos | zero deps, max control | two SQL codebases, drift risk | High |
| **Kysely (recommended)** | typed query builder, first-class PG+MySQL dialects, `onConflict` (PG) & `onDuplicateKeyUpdate` (MySQL) both supported, no schema DSL, tiny surface, pure-SQL mental model fits Clean Architecture | migrations need small per-dialect branches | Low-Med |
| Drizzle | TS-native schema, dual dialect, popular | another DSL to learn; schema layer couples domain-ish packages | Med |
| Prisma | great DX single-engine | provider fixed at generate-time (bad for runtime env-var choice), engine binary, migration divergence | High |

Recommendation: **Kysely**, hand-written TS migrations branching per dialect ONLY where SQL differs (`jsonb` vs `json`, upsert clause). Domain defines its own `Repository` interfaces + DTOs; infra package implements them over a Kysely instance constructed from `DATABASE_URL`/`DATABASE=postgres|mysql`. Event payload stored as JSON column but ALL queried metrics live in relational columns — v1 never queries INTO the JSON payload.

## Q4 — Ingestion API shape

- `POST /v1/events/batch` body `{ events: UsageEvent[] }` (max 500/batch), header `X-API-Key`. Response `202 { accepted, duplicates }`. Validation: zod schema from `@agent-analytics/event-schema`; invalid events rejected individually (per-event errors array), batch not failed wholesale.
- Idempotency: `event.id` is client-generated UUIDv7 (time-sortable); PK insert `ON CONFLICT DO NOTHING` (PG) / `INSERT IGNORE` (MySQL) ⇒ retries are safe.
- Auth v1: single static API key via env (`ANALYTICS_API_KEY`), stored comparison-safe (timingSafeEqual). Table `api_keys` (hashed keys, per user/team) designed now, activated later — keeps multi-user story cheap without building it twice.
- Backpressure contract (plugin side): non-blocking fire-and-forget enqueue; bounded queue (10k events, drop-oldest with drop counter metric); flush on 100 events OR 1s timer OR `session.idle` OR `dispose`; retry with exponential backoff + jitter on 5xx/network, give-up after N attempts to disk-spill file (optional v1.1).
- Server framework: Fastify + zod (lightweight, TS-first, schema validation native; avoids NestJS ceremony for 3 endpoints).

## Q5 — Dashboard stack

Vite + React + TypeScript + React Router + TanStack Query + **Recharts** (boring, declarative, good-enough). Tailwind v4 for styling. No SSR, no state library (server cache only). Pages: Overview, Agents, Skills, Versions, Executions (drill-down = execution tree viewer from traceId).

## Q6 — Monorepo tooling

**npm workspaces + TypeScript project references** (no path aliases across packages; packages depend via workspace names like `@agent-analytics/event-schema`). Rationale: zero extra tooling, ships with Node, sufficient for 6 workspaces. pnpm/turborepo deferred — nothing in v1 needs them. One `tsconfig.base.json` (strict, noUncheckedIndexedAccess), Jest per-package with shared jest.preset.

## Approaches (roadmap slicing, review_budget_lines=400, ask-on-risk)

1. **Five sequential SDD changes** (recommended)
   - C1 `bootstrap-agent-analytics`: monorepo scaffold + event-schema package. Effort: Low-Med (~400 lines risk: Medium)
   - C2 `collector-plugin`: plugin + mappers + buffer/retry + privacy flags. Effort: Medium
   - C3 `api-database-persistence`: Fastify ingest + Kysely repos + dual migrations. Effort: Medium-High (chained PRs likely)
   - C4 `dashboard-core`: Vite app + Overview + Agents/Skills lists. Effort: Medium
   - C5 `evolution-metrics`: version/combo analytics endpoints + Versions page. Effort: Medium
   - Pros: every slice independently verifiable against real OpenCode; each ≤ ~400 lines with discipline. Cons: more ceremony overhead.
2. **Three fat changes** (schema+collector | api+db | dashboard+evolution)
   - Pros: fewer phases. Cons: 600–900 lines per change ⇒ blows review budget; violates guard. Not recommended.

CHANGE #1 concrete scope: root configs (tsconfig.base strict, eslint flat, prettier, jest), npm workspaces layout (empty package skeletons), `packages/event-schema`: canonical `UsageEvent` zod schemas + inferred types + normalization/pure helpers (status mapping, token extraction) + unit tests. Explicitly OUT: collector, api, db, dashboard. Forecast lines ~380–480 ⇒ `Decision needed before apply: No` · `Chained PRs recommended: Maybe (split configs/scaffold PR from event-schema PR if >450)` · `400-line budget risk: Medium`.

## Recommendation

Build CHANGE #1 exactly as scoped above (scaffold + event-schema). The canonical UsageEvent stays AS SPECIFIED in the brief; exploration adds only: UUIDv7 ids, `execution.traceId` = root sessionId, `actor.userId` sourced from collector config (native identity gap), and `agent.version` resolution ladder (Q2). Feasibility is PROVEN against current docs/types — no blocking gap except the documented actor/version derivations.

## Risks

- OpenCode is fast-moving: event payloads may evolve; pin tested OpenCode version range in collector README; keep mapper layer thin and table-driven so drift fixes are one-file.
- Unknown hooks fail silently (no error) ⇒ collector MUST self-check (log hook registration + heartbeat event on startup).
- No native user identity (single-user assumption) — multi-user deployments need one install/config per user; document clearly.
- Built-in agents have no definition file ⇒ hash sentinel strategy must be explicit in specs to avoid null-hash ambiguity.
- Stale opencode processes won't dispatch hooks to newly installed plugins (restart needed) — installation instructions MUST include restart step.
- Subagent cost attribution: child sessions have own assistant messages; attribution rule (child costs roll up to invoking agent execution) must be pinned in spec phase.

## Ready for Proposal

YES — run sdd-propose for change `bootstrap-agent-analytics` with the CHANGE #1 scope above.
