# Tasks: Agent/Skill Version Tracking

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 180–220 |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | Single PR |
| Delivery strategy | auto-chain |
| Chain strategy | stacked-to-main |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: stacked-to-main
400-line budget risk: Low

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|------|------|-----------|----------------------|-----------------|-------------------|
| 1 | Single PR: DB schema + repository + API routes + dashboard pages | PR 1 | `pnpm test` across all packages | API endpoint calls + dashboard navigation | Full revert of PR (additive nullable column, new endpoint, new page) |

## Phase 1: Database Foundation

- [x] 1.1 Add nullable `version` text column to `definitions` table in `packages/database/src/schema.ts`
- [x] 1.2 Generate Drizzle migration for `version` column addition
- [x] 1.3 Add index `idx_definitions_entity_version` on `(entity_name, version)` in schema
- [x] 1.4 Update `AgentDetail` interface in `packages/database/src/repository.ts`: add `distinctVersions: number` and `byVersion: Array<{ version, executionCount, successRate, totalCost }>`
- [x] 1.5 Update `Definition` interface in repository: add `version: string | null`

## Phase 2: Repository Methods

- [x] 2.1 Add `getAgentDetail(agentName)` method with GROUP BY `(agentName, version)` query returning `byVersion` and `distinctVersions`
- [x] 2.2 Update `upsertDefinition` signature to accept optional `version?: string | null` parameter
- [x] 2.3 Update `getDefinitionByHash` to map `version` column into returned `Definition`

## Phase 3: API Routes

- [x] 3.1 Add `version` to `DefinitionBodySchema` (optional string) in `apps/api/src/routes/definitions.ts`
- [x] 3.2 Pass `version` to `upsertDefinition` call in definition upsert handler
- [x] 3.3 Include `version` in `GET /v1/definitions` list response mapping
- [x] 3.4 Verify `GET /v1/stats/agents/:name` route returns `getAgentDetail` result (check `apps/api/src/routes/stats.ts` — may already work)

## Phase 4: Dashboard UI

- [x] 4.1 Add `byVersion` and `distinctVersions` to `AgentDetail` interface in `apps/dashboard/src/api/types.ts`
- [x] 4.2 Add `version: string | null` to `Definition` interface in types
- [x] 4.3 Add version breakdown table to `AgentDetailPage.tsx` (render `data.byVersion` rows with version, executionCount, successRate, totalCost)
- [x] 4.4 Add "Distinct Versions" stat card to `AgentDetailPage.tsx`
- [x] 4.5 Fix definition lookup hash in `AgentDetailPage.tsx`: use content-based hash instead of `name` (match `generateContentHash` pattern from ingestion)
- [x] 4.6 Add version column to recent events table in `AgentDetailPage.tsx` (show `e.skill?.version ?? '—'`)
- [x] 4.7 Add version column to `DefinitionsPage.tsx` list table
- [x] 4.8 Verify `SkillDetailPage.tsx` definition lookup is consistent with agent pattern

## Phase 5: Testing

- [x] 5.1 Unit test: `getAgentDetail` returns correct `distinctVersions` and `byVersion` counts for multi-version events
- [x] 5.2 Unit test: `getAgentDetail` returns 404/throws for unknown agent
- [x] 5.3 Unit test: `upsertDefinition` with version sets column, without version leaves NULL
- [x] 5.4 Unit test: `getDefinitionByHash` returns `version` field
- [x] 5.5 Integration test: `GET /v1/stats/agents/:name` returns full response shape with `byVersion` array
- [x] 5.6 Integration test: `GET /v1/stats/agents/nonexistent` returns 404
- [x] 5.7 Integration test: `PUT /v1/definitions/:hash` with version persists, `GET` list includes version
- [x] 5.8 E2E test: Agent detail page renders version breakdown table
- [x] 5.9 E2E test: Definitions list page shows version column
