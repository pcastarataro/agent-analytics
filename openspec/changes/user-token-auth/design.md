# Design: User Token Authentication

## Technical Approach

Replace the current no-op `authStub` middleware with real API-key authentication backed by a `users` table. The collector sends `X-API-Key`; the server hashes it via bcrypt and looks up the user. Dashboard sessions use short-lived JWTs (1h, no refresh). This maps directly to the proposal's approach — clean migration, bcrypt hashing, server-side userId injection.

## Architecture Decisions

| Decision | Choice | Alternatives | Rationale |
|----------|--------|--------------|-----------|
| Key hashing | bcrypt (cost 10) | SHA-256, argon2 | bcrypt is battle-tested, no extra deps beyond npm package; argon2 requires native build |
| JWT library | `jsonwebtoken` | `jose`, manual signing | `jsonwebtoken` is most widely used for Express; `jose` is ESM-only which complicates CJS imports |
| Auth middleware scope | Per-route-group (`/v1/events`, `/v1/stats`) | Global with skip list | Explicit per-group is safer — new routes aren't protected by default |
| Dashboard auth storage | `localStorage` | `sessionStorage`, httpOnly cookie | Simple for SPA; no refresh token flow needed; httpOnly cookie would require backend session store |
| Migration strategy | Destructive clean slate | Preserving existing userId | Pre-production; clean slate simplifies migration |

## Data Flow

```
Collector ──X-API-Key──→ Auth Middleware ──→ Event Routes
                           │ (bcrypt hash, DB lookup)
                           └→ req.user = { id, name }
                           │
                           ↓
                    Batch Ingestion
                    (server injects actor.userId from req.user.id)
```

```
Dashboard ──Authorization: Bearer──→ JWT Middleware ──→ User Routes
                (JWT from localStorage)    │ (verify signature)
                                           └→ req.user = { id, name }
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `packages/database/src/schema.ts` | Modify | Add `users` table definition |
| `packages/database/migrations/0006_users.sql` | Create | Create users table, index, clean events |
| `packages/database/src/repository.ts` | Modify | Add `UserRepository` methods (CRUD, key lookup) |
| `packages/database/src/index.ts` | Modify | Export `UserRepository` |
| `apps/api/src/config.ts` | Modify | Add `JWT_SECRET` to config |
| `apps/api/src/middleware/auth.ts` | Modify | Replace `authStub` with `apiKeyAuth` + `jwtAuth` |
| `apps/api/src/routes/auth.ts` | Create | `POST /v1/auth/login` route |
| `apps/api/src/routes/users.ts` | Create | User CRUD routes (`/v1/users`) |
| `apps/api/src/server.ts` | Modify | Mount new routes, apply middleware per group |
| `apps/api/src/routes/events.ts` | Modify | Inject `actor.userId` from `req.user` in batch handler |
| `packages/opencode-collector/src/domain/config-schema.ts` | Modify | Remove `userId` field and `ENV_USER` |
| `packages/opencode-collector/src/infra/http-client.ts` | No change | Already sends `X-API-Key` header |
| `apps/dashboard/src/App.tsx` | Modify | Add `/login` route, wrap in `AuthProvider` |
| `apps/dashboard/src/contexts/AuthContext.tsx` | Create | Auth state, login/logout, token attach, 401 handling |
| `apps/dashboard/src/pages/LoginPage.tsx` | Create | Login form page |
| `apps/dashboard/src/pages/UsersPage.tsx` | Modify | Replace analytics table with user management |
| `apps/dashboard/src/components/Layout.tsx` | Modify | Add logout button, conditional nav |
| `apps/dashboard/src/components/CreateUserModal.tsx` | Create | Create user modal with API key display |
| `apps/dashboard/src/components/ConfirmDialog.tsx` | Create | Revoke/regenerate confirmation dialog |
| `apps/dashboard/src/api/client.ts` | Modify | Attach `Authorization` header from auth context |

## Interfaces / Contracts

```typescript
// packages/database/src/schema.ts — new table
export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull().unique(),
    passwordHash: text('password_hash').notNull(),
    apiKeyHash: text('api_key_hash'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index('idx_users_api_key_hash').on(table.apiKeyHash)],
);

// apps/api/src/middleware/auth.ts — middleware signatures
export function apiKeyAuth(repository: UserRepository): RequestHandler;
export function jwtAuth(secret: string): RequestHandler;

// apps/api/src/routes/auth.ts
// POST /v1/auth/login → { token: string; user: { id: string; name: string } }
// Accepts: { name: string, password: string }

// apps/api/src/routes/users.ts
// GET    /v1/users       → [{ id, name, createdAt, updatedAt }]
// POST   /v1/users       → { id, name, api_key, createdAt }  (key shown once)
//                           Accepts: { name: string, password: string }
// DELETE /v1/users/:id   → 204
// POST   /v1/users/:id/key/revoke     → { success: true }
// POST   /v1/users/:id/key/regenerate → { api_key: string }

// apps/dashboard/src/contexts/AuthContext.tsx
interface AuthContextType {
  user: { id: string; name: string } | null;
  token: string | null;
  login: (name: string, password: string) => Promise<void>;
  logout: () => void;
}
```

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | `apiKeyAuth` middleware — valid/missing/invalid/revoked keys | Mock repository, assert req.user or 401 |
| Unit | `jwtAuth` middleware — valid/expired/missing tokens | Mock jwt.verify, assert req.user or 401 |
| Unit | User CRUD routes — create, list, delete, revoke, regenerate | Supertest with mock repo |
| Unit | Login route — valid name, unknown name, missing body | Supertest with mock repo |
| Unit | Collector config — userId removed, apiKey required | Unit test schema validation |
| Integration | Full auth flow — create user → send events → verify userId injection | Test DB + API server together |
| Integration | Dashboard login → JWT → user management CRUD | Supertest with real DB |
| E2E | Login page → create user → copy key → collector sends events → dashboard shows data | Browser + API + DB |

## Migration / Rollout

```sql
-- 0006_users.sql
CREATE TABLE IF NOT EXISTS "users" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "name" text NOT NULL UNIQUE,
  "password_hash" text NOT NULL,
  "api_key_hash" text,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "idx_users_api_key_hash" ON "users" ("api_key_hash");
DELETE FROM "usage_events";
CREATE INDEX IF NOT EXISTS "idx_usage_events_user_id" ON "usage_events" USING btree ((actor::jsonb->>'userId'));
```

Single destructive migration — deletes all existing events (pre-production clean slate). Both DB and collector changes ship together.

## Threat Matrix

N/A — no routing, shell, subprocess, VCS/PR automation, executable-file classification, or process-integration boundary. This change is purely data model + auth middleware + UI.

## Open Questions

- [ ] `JWT_SECRET` — generate random on startup or require explicit env var? Recommend explicit env var with a random default for dev.
- [ ] Should `/v1/auth/login` accept `api_key` as an alternative login method (for programmatic dashboard access)? Out of scope per proposal.
- [x] Password for login? CONFIRMED: name + password + JWT (full auth mechanism).
