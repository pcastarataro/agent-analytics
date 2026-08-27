# Design: Agent/Skill Version Tracking

## Technical Approach

Extend existing per-version aggregation pattern (used in `getMetricsAggregation` evolution section) to `AgentDetail`. Add `byVersion` array with GROUP BY `(agentName, version)`. Add nullable `version` column to `definitions` table. Fix definitionHash mismatch by using consistent content-based hash for detail page lookups.

## Architecture Decisions

### Decision: AgentDetail `byVersion` shape

**Choice**: `Array<{ version, executionCount, successRate, totalCost }>` — reuse `AgentVersionMetrics` from `EvolutionMetrics`.

**Alternatives considered**: Full `SkillDetail.versions`-like shape with more fields; custom shape with `avgDurationMs`.

**Rationale**: Matches the existing `AgentVersionMetrics` interface in `types.ts:29-35`. Consistent with how `getMetricsAggregation` already groups by version. Simpler than adding per-version avgDuration.

### Decision: Version column on definitions

**Choice**: Nullable `text` column, optional in upsert. Existing rows get `NULL`.

**Alternatives considered**: Non-nullable with default `'0.0.0'`; separate `definition_versions` table.

**Rationale**: Backward-compatible (nullable = no migration of existing data). Definitions table is simple key-value; separate table adds JOIN complexity for no benefit. Version is metadata, not a partitioning key.

### Decision: Hash mismatch fix

**Choice**: Detail pages compute hash from `definition.content` (matching ingestion `generateContentHash` pattern).

**Alternatives considered**: Use entity name as lookup key; store hash separately on event.

**Rationale**: Current code uses `entityName` as hash (`AgentDetailPage:33`, `SkillDetailPage:32`) but ingestion uses `generateContentHash(event)` which hashes event fields. The fix aligns both sides to content-based hashing.

## Data Flow

    Ingestion                         Detail Page
    ─────────                         ───────────
    Event arrives                     User navigates /agents/:name
         │                                  │
    generateContentHash(event)         GET /v1/stats/agents/:name
         │                                  │
    contentHash column                  getAgentDetail(name)
         │                                  │
    ┌────┴────┐                     GROUP BY version ──→ byVersion[]
    │ content │                     GROUP BY date    ──→ eventsOverTime[]
    │ version │ (jsonb)             ORDER BY timestamp──→ recentEvents[]
    └─────────┘
                                           │
                                    GET /v1/definitions?entityType=agent&entityName=:name
                                           │
                                    Definition with version field

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `packages/database/src/schema.ts` | Modify | Add nullable `version` text column to `definitions` table |
| `packages/database/src/repository.ts` | Modify | Add `byVersion` + `distinctVersions` to `AgentDetail` interface; add GROUP BY version query in `getAgentDetail`; update `upsertDefinition` signature to accept optional `version`; update `getDefinitionByHash` to include version; add index on `(entityName, version)` |
| `apps/api/src/routes/stats.ts` | Modify | No change needed — route already exists, returns `getAgentDetail` result |
| `apps/api/src/routes/definitions.ts` | Modify | Add `version` to `DefinitionBodySchema`; pass version to `upsertDefinition`; include version in list response |
| `apps/dashboard/src/api/types.ts` | Modify | Add `byVersion: Array<{ version, executionCount, successRate, totalCost }>` and `distinctVersions: number` to `AgentDetail`; add `version` to `Definition` interface |
| `apps/dashboard/src/pages/AgentDetailPage.tsx` | Modify | Add version breakdown table; fix definition lookup hash; add version to recent events table |
| `apps/dashboard/src/pages/SkillDetailPage.tsx` | Modify | Verify consistency with agent pattern (definition lookup) |
| `apps/dashboard/src/pages/DefinitionsPage.tsx` | Modify | Add version column to definitions list |

## Interfaces / Contracts

### Extended `AgentDetail` (repository + dashboard types)

```typescript
// packages/database/src/repository.ts
export interface AgentDetail {
  agentName: string;
  totalEvents: number;
  successRate: number;
  avgDurationMs: number;
  totalCost: number;
  avgCost: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCachedTokens: number;
  distinctVersions: number;          // NEW
  byVersion: Array<{                 // NEW
    version: string;
    executionCount: number;
    successRate: number;
    totalCost: number;
  }>;
  eventsOverTime: Array<{ date: string; count: number }>;
  tokensBySkill: Array<{ name: string; tokens: number }>;
  recentEvents: UsageEvent[];
}
```

### Extended `Definition` interface

```typescript
// packages/database/src/repository.ts
export interface Definition {
  hash: string;
  content: string;
  entityType: string;
  entityName: string;
  version: string | null;  // NEW
  createdAt: Date;
  updatedAt: Date;
}
```

### Extended `upsertDefinition` signature

```typescript
upsertDefinition(
  hash: string,
  content: string,
  entityType: string,
  entityName: string,
  version?: string | null,  // NEW optional param
): Promise<void>;
```

### GET /v1/stats/agents/:name response

```json
{
  "agentName": "alpha",
  "totalEvents": 50,
  "successRate": 96.0,
  "avgDurationMs": 1200,
  "totalCost": 0.45,
  "avgCost": 0.009,
  "distinctVersions": 2,
  "byVersion": [
    { "version": "1.0.0", "executionCount": 30, "successRate": 93.3, "totalCost": 0.27 },
    { "version": "1.1.0", "executionCount": 20, "successRate": 100.0, "totalCost": 0.18 }
  ],
  "eventsOverTime": [...],
  "tokensBySkill": [...],
  "recentEvents": [...]
}
```

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | `getAgentDetail` byVersion aggregation | Mock db with multi-version events, verify `distinctVersions` and `byVersion` counts |
| Unit | `upsertDefinition` with/optional version | Mock db insert, verify version column set or NULL |
| Unit | `getDefinitionByHash` returns version | Mock db select, verify version field mapped |
| Integration | `GET /v1/stats/agents/:name` endpoint | Seed events across 2 versions, assert response shape |
| Integration | `GET /v1/stats/agents/:nonexistent` returns 404 | No seed, assert 404 |
| Integration | Definition upsert with version | PUT definition with version, GET back, verify version field |
| E2E | Agent detail page shows version breakdown | Navigate to /agents/:name, verify version table renders |
| E2E | Definitions list shows version column | Navigate to /definitions, verify version column visible |

## Migration / Rollout

Drizzle migration: `ALTER TABLE definitions ADD COLUMN version text;` — nullable, no data migration needed. Existing rows get `NULL`. Add index: `CREATE INDEX idx_definitions_entity_version ON definitions (entity_name, version);`

No rollback risk — nullable column is purely additive. Down migration: `ALTER TABLE definitions DROP COLUMN version;`

## Open Questions

- [ ] Should `definitionHash` in events be recomputed for existing events, or is the current hash sufficient for lookups? (Proposal says fix the mismatch, but recomputing hashes is a larger migration.)
- [ ] Is the `version` column on definitions purely for display, or should it filter/group definitions in the list view?
