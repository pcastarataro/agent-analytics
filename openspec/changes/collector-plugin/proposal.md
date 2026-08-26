# Proposal: OpenCode Usage Collector Plugin

## Intent

C1 shipped the UsageEvent contract; nothing emits yet. Deliver `packages/opencode-collector`: an OpenCode plugin emitting schema-valid UsageEvents — feeds API/database/dashboard.

## Scope

### In Scope
- Plugin entry: raw TS auto-loaded from `.opencode/plugins/` (Bun, no build); types-only peer; defensive boundary — never throws into OpenCode; self-check via `client.app.log`.
- Mappers per Gap-3 table verbatim: session root/child (`traceId`=ROOT id + `parentId`), prompts, `callID` correlation + `skill` detection, ToolPart completion, model-calls, errors, idle/dispose flushes.
- Fidelity+privacy: event-schema helpers (`resolveStatus`, ladder, sentinel); validate pre-enqueue (log+drop invalid); capture default-off ⇒ length/hash only.
- Buffer/client: plain fetch + AbortController; flush @100 OR 1s OR idle/dispose; queue 10k drop-oldest + counter; retry ≤~5 backoff+jitter then drop-with-counter.
- Config: env > `.opencode/analytics.json` > pure defaults (pure-domain zod).
- Tests: fixture mappers (A) + fake-timer/injected-fetch buffer tests (B) mandatory; skippable mock-server smoke (C).

### Out of Scope
- API/database/dashboard/evolution metrics; Copilot/GitLab/Claude Code collectors; npm build/publish; disk spill (v1.1); StepFinishPart enrichment.

## Capabilities

### New Capabilities
- `usage-collector`: OpenCode activity → canonical UsageEvents — correlation, privacy gating, buffering/delivery, config chain, non-blocking guarantee.

### Modified Capabilities
None (existing specs unchanged).

## Approach

TS-source-first (exploration Approach 1): Bun executes raw TS; dogfood shim `.opencode/plugins/analytics.ts`. Pure domain mappers/config; infra injected into closure. Default under ask-on-risk: stacked chain B1′→B2′→B3′ to main.

## Affected Areas

| Area | Impact | Description |
|---|---|---|
| `packages/opencode-collector/src/` | New | entry, mappers, buffer/http-client, config |
| `packages/opencode-collector/__tests__/` | New | mapper/buffer/smoke suites |
| `.opencode/plugins/analytics.ts` | New | dogfood shim |
| `openspec/specs/usage-collector/spec.md` | New | created at archive |

## Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| Payload drift | Med | last-write-wins mappers + idle reconciliation + fixtures |
| Unknown-hook silence | Low | heartbeat self-check log |
| Slice budget exceed | Med | re-forecast at tasks; split if >450 |
| Smoke needs binary | Med | `describe.skipIf` guard |

## Rollback Plan

Purely additive. Kill-switch: delete shim or set `OPENCODE_ANALYTICS_DISABLED=true`. Revert slice PRs independently. Boundary contains failures.

## Dependencies

- `@agent-analytics/event-schema`: helpers + `usageEventSchema`.
- `@opencode-ai/plugin` ≥1.x peer (types); native fetch.
- Local `opencode` binary (smoke only).

## Success Criteria

- [ ] `npx jest packages/opencode-collector` green; fixtures schema-valid; privacy defaults proven.
- [ ] `npx tsc --noEmit && npx eslint .` clean.
- [ ] Smoke gets ≥1 valid batch when binary present, else skips.
- [ ] No exception reaches hooks.

## Review Workload Forecast

Bottom-up ≈1,170–1,220 lines / 3 slices (≈450/440/310).
Decision needed before apply: Yes — confirm stacked 3-PR chain (default).
Chained PRs recommended: Yes — B1′→B2′→B3′ stacked to main.
400-line budget risk: Medium.

Next: sdd-spec (pin Gap-3 table, roll-up rule) → design → tasks.
