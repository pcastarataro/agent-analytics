# Proposal: Agent/Skill Version Tracking

## Intent

Agent and skill detail endpoints aggregate ALL versions into a single blob — users can't see per-version breakdowns for agents. The definitions table has no `version` column, so definitions aren't version-controllable. Detail pages show no version information. A definitionHash mismatch bug causes detail page hash lookups to fail (entity name used as hash vs. events using a different hash).

## Scope

### In Scope
- Add `AgentDetail` response with `byVersion` array (reuses existing `SkillDetail.versions` pattern)
- Add `GET /v1/stats/agents/:name` endpoint with GROUP BY version aggregation
- Add nullable `version` column to `definitions` table via Drizzle migration
- Update `upsertDefinition` to accept optional `version` parameter
- Update `GET /v1/definitions` to include `version` in list response
- Fix definitionHash mismatch: detail pages must use consistent hash (content-based, not entity name)
- Add Agent Detail Page to dashboard with version breakdown table
- Add version column to definitions list page

### Out of Scope
- Version comparison/diffing UI
- Automatic version detection from definition content changes
- Migration tooling for existing definitions without versions
- Skill Detail Page changes (already has version breakdown per existing spec)

## Capabilities

### New Capabilities
- `agent-detail`: Agent detail endpoint with per-version aggregation (extends existing agent stats)

### Modified Capabilities
- `api-server`: Add agent detail endpoint, add version to definitions schema/routes, fix definitionHash mismatch
- `dashboard-ui`: Add Agent Detail Page, add version column to definitions list

## Approach

1. Add `byVersion` array to `AgentDetail` interface (mirror `SkillDetail.versions`)
2. Add `getAgentDetail()` repository method with GROUP BY `(agentName, version)` query
3. Add `GET /v1/stats/agents/:name` route returning aggregated + per-version stats
4. Add nullable `version` text column to `definitions` table (Drizzle migration)
5. Update `upsertDefinition` and `getDefinitionByHash` to include version
6. Fix definitionHash: use consistent content-based hash for detail page lookups
7. Add Agent Detail Page component with version breakdown table
8. Update definitions list to show version column

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `packages/database/src/repository.ts` | Modified | `getAgentDetail()` method, `upsertDefinition` version param |
| `packages/database/src/schema.ts` | Modified | `definitions` table gets nullable `version` column |
| `apps/api/src/routes/stats.ts` | Modified | `GET /v1/stats/agents/:name` route |
| `apps/api/src/routes/definitions.ts` | Modified | Version in upsert schema, list response |
| `apps/dashboard/src/api/types.ts` | Modified | `AgentDetail` interface with `byVersion` |
| `apps/dashboard/src/pages/AgentDetailPage.tsx` | New | Agent detail with version breakdown |
| `apps/dashboard/src/pages/SkillDetailPage.tsx` | Modified | Verify consistency with agent pattern |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| definitionHash mismatch fix breaks existing definitions | Medium | Check existing definitions table for hash format before migrating |
| GROUP BY version query performance with many versions | Low | Version cardinality is inherently low (semver); index on (entityName, version) |
| Dashboard route addition conflicts with existing routes | Low | `/agents/:agentName` path is new, no conflicts |

## Rollback Plan

1. Revert database migration (drop `version` column from definitions)
2. Revert `getAgentDetail` method — detail endpoint returns 404
3. Revert `upsertDefinition` signature — version param ignored (nullable)
4. Remove Agent Detail Page from dashboard
5. All existing endpoints and UI remain functional (non-breaking: nullable column, new endpoint)

## Dependencies

- Existing `SkillDetail.versions` pattern (reuse as-is for agent detail)
- Drizzle migration tooling (already in place)
