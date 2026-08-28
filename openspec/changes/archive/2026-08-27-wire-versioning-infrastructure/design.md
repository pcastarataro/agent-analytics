# Design: Wire Versioning Infrastructure

## Technical Approach

Complete the wiring of `version` and `definitionHash` from collector events through to dashboard display. Four surgical file edits: extend domain types, extract version/hash from skill args, propagate through event hooks, and fix dashboard hash computation. Schema already supports optional `version`/`definitionHash` on `agent` and `skill` — no schema changes needed.

## Architecture Decisions

| Option | Tradeoff | Decision |
|--------|----------|----------|
| Thread version/hash via ExecutionContext only | Simpler but lost when skill tool args carry it independently | **Store on ToolCall too** — skill version/hash comes from args, not session context |
| New hook event type for skill completion | Cleaner separation but adds consumer complexity | **Reuse `mapSkillComplete`** — already exists, already exported, just unused |
| Hash algo: SHA-256 full vs truncated | Full = 64 hex chars, truncated = 32 | **Truncated 32 hex chars** — matches existing convention in DefinitionUpload |
| Builtin sentinel: `builtin:<name>` vs empty string | Empty loses distinction between "no definition" and "has definition" | **`builtin:<name>` sentinel** — matches `builtinDefinitionHash()` in event-schema |

## Data Flow

```
OpenCode Hook Payload
        │
        ▼
┌─ handleToolBefore ──────────────────────────────────┐
│  mapToolBefore(payload, toolCalls)                   │
│    ├─ tool === 'skill'?                              │
│    │   ├─ Extract name, version, definitionHash      │
│    │   │   from payload.input.args                   │
│    │   │   → Store on ToolCall record                │
│    │   │   → Return { skill: {name, version, hash} } │
│    │   └─ else → Return { tool: {name} }             │
│    └─ Enqueue event with version/hash fields         │
└──────────────────────────────────────────────────────┘
        │
        ▼
┌─ handleToolAfter ───────────────────────────────────┐
│  mapToolAfter(payload, toolCalls)                    │
│    ├─ Look up ToolCall by callID                     │
│    ├─ Close timing, set status                       │
│    └─ Return { tool, skill?, metrics, result }       │
│                                                       │
│  NEW: if tc.toolName === 'skill' && tc.skillName:    │
│    └─ Call mapSkillComplete({                        │
│         skill: { name, version, definitionHash }     │
│       }) → Merge into event fields                   │
│                                                       │
│  Enqueue event with version/hash from ToolCall       │
└──────────────────────────────────────────────────────┘
        │
        ▼
   UsageEvent (schema validates optional fields)
        │
        ▼
   Database → API → Dashboard (/definitions, detail page)
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `packages/opencode-collector/src/domain/types.ts` | Modify | Add `version?` and `definitionHash?` to `ExecutionContext` and `ToolCall` |
| `packages/opencode-collector/src/mappers/tool-skill-mapper.ts` | Modify | Extract version/hash from skill args in `mapToolBefore`; include in `mapToolAfter` return |
| `packages/opencode-collector/src/index.ts` | Modify | In `handleToolAfter`: call `mapSkillComplete` when tool is `skill`; propagate version/hash to event fields |
| `apps/dashboard/src/components/DefinitionUpload.tsx` | Modify | Fix `computeHash` to hash `content` not `entityType:entityName` |

## Interfaces / Contracts

### ExecutionContext (types.ts)

```typescript
export interface ExecutionContext {
  sessionId: string;
  traceId: string;
  parentId?: string;
  agentName?: string;
  version?: string;          // NEW
  definitionHash?: string;   // NEW
  eventType?: 'session_created' | 'user_message' | 'assistant_message' | 'tool_call' | 'skill_call';
}
```

### ToolCall (types.ts)

```typescript
export interface ToolCall {
  callID: string;
  toolName: string;
  skillName?: string;
  version?: string;          // NEW
  definitionHash?: string;   // NEW
  startTime: number;
  endTime?: number;
  status?: 'success' | 'error';
}
```

### mapToolBefore — skill branch changes

```typescript
// Inside tool === 'skill' block:
const skillName = ((args as Record<string, unknown> | undefined)?.name as string) ?? 'unknown';
const version = (args as Record<string, unknown> | undefined)?.version as string | undefined;
const definitionHash = (args as Record<string, unknown> | undefined)?.definitionHash as string | undefined;

tc.skillName = skillName;
tc.version = version;             // NEW
tc.definitionHash = definitionHash; // NEW

return {
  execution: { eventType: 'tool_call' as const },
  skill: {
    name: skillName,
    ...(version !== undefined && { version }),
    ...(definitionHash !== undefined && { definitionHash }),
  },
  tool: { name: tool },
};
```

### handleToolAfter — call mapSkillComplete

```typescript
// After mapToolAfter returns fields, before enqueueEvent:
const tc = toolCalls.get(payload.input.callID);
if (tc?.toolName === 'skill' && tc.skillName) {
  const skillFields = mapSkillComplete({
    skill: {
      name: tc.skillName,
      version: tc.version,
      definitionHash: tc.definitionHash,
    },
  });
  // Merge skillFields into fields (overwrites eventType and skill)
  Object.assign(fields, skillFields);
}
```

### computeHash — DefinitionUpload.tsx

```typescript
async function computeHash(content: string): Promise<string> {
  const encoder = new TextEncoder();
  const buffer = await crypto.subtle.digest('SHA-256', encoder.encode(content));
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, 32);
}

// In handleSave:
const hash = await computeHash(content);  // was: computeHash(entityType, entityName)
```

## Agent Version/Hash in Events

`handleSessionCreated` and `handleMessageUpdated` set `agent: { name: ctx.agentName }`. Since `ExecutionContext` will carry `version?` and `definitionHash?`, add them to the agent event fields:

```typescript
// In handleSessionCreated:
agent: {
  name: ctx.agentName ?? 'unknown',
  ...(ctx.version !== undefined && { version: ctx.version }),
  ...(ctx.definitionHash !== undefined && { definitionHash: ctx.definitionHash }),
},

// Same pattern in handleMessageUpdated and handleToolBefore/After
```

For built-in agents (no definition), `builtinDefinitionHash(agentName)` from `@agent-analytics/event-schema` produces the `builtin:<name>` sentinel. Callers set this on `ExecutionContext` when the agent has no user-uploaded definition.

## Migration / Rollback

No migration required. Schema fields are optional — existing events with `version: undefined` / `definitionHash: undefined` validate fine. Dashboard's `/definitions/:hash` route already handles unknown hashes gracefully. Old `entityType:entityName` hashes in existing definitions remain resolvable; new uploads produce content-based hashes. Users re-upload to get content-based hashes.

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | `mapToolBefore` extracts version/hash from skill args | Call with `args: { name: "x", version: "1.0", definitionHash: "h1" }`, assert returned `skill.version`/`skill.definitionHash` |
| Unit | `mapToolBefore` handles missing version/hash | Call with `args: { name: "x" }`, assert version/hash undefined in output |
| Unit | `mapToolAfter` includes version/hash on ToolCall | Set up ToolCall with version/hash, call `mapToolAfter`, verify output |
| Unit | `mapSkillComplete` returns skill_call eventType | Already tested implicitly — verify name/version/hash passthrough |
| Unit | `computeHash` hashes content not entity | Call with two different names + same content → same hash; same name + different content → different hash |
| Integration | `handleToolAfter` calls `mapSkillComplete` for skill tools | Mock toolCalls map with skill entry, verify emitted event has `eventType: 'skill_call'` |
| Integration | `handleToolAfter` does NOT call `mapSkillComplete` for non-skill tools | Mock toolCalls with non-skill entry, verify `eventType: 'tool_call'` |
| E2E | Full event flow with version/hash | Feed hook payloads through collector, verify emitted events have populated version/hash fields |

## Threat Matrix

N/A — no routing, shell, subprocess, VCS/PR automation, executable-file classification, or process-integration boundary.

## Open Questions

None — all dependencies exist (`mapSkillComplete`, `builtinDefinitionHash`, Zod optional fields). Design is fully scoped.
