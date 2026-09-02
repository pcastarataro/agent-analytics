# Tasks: User Token Authentication

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 650–850 |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 → PR 2 → PR 3 |
| Delivery strategy | auto-chain |
| Chain strategy | stacked-to-main |

Decision needed before apply: No (user approved chained PRs)
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|------|------|-----------|----------------------|-----------------|-------------------|
| 1 | DB schema + migration + UserRepository | PR 1 | `pnpm --filter @agent-analytics/database test` | `docker compose up -d postgres && pnpm drizzle-kit push` | packages/database only |
| 2 | API auth middleware + routes + server wiring | PR 2 | `pnpm --filter @agent-analytics/api test` | POST /v1/auth/login + POST /v1/events/batch with X-API-Key | apps/api only |
| 3 | Collector + installer + dashboard UI | PR 3 | `pnpm --filter @agent-analytics/dashboard test` | Full flow: login → create user → copy key → collector sends events | packages/opencode-collector, packages/installer, apps/dashboard |

## Phase 1: Database Layer

- [ ] 1.1 Add `users` table to `packages/database/src/schema.ts` — columns: id (uuid PK), name (text UNIQUE NOT NULL), passwordHash (text NOT NULL), apiKeyHash (text nullable), createdAt/updatedAt (timestamptz). Index on apiKeyHash.
- [ ] 1.2 Create `packages/database/migrations/0006_users.sql` — CREATE TABLE users, CREATE INDEX idx_users_api_key_hash, DELETE FROM usage_events, CREATE INDEX idx_usage_events_user_id on `actor->>'userId'`.
- [ ] 1.3 Add `UserRepository` interface and `createUserRepository()` to `packages/database/src/repository.ts` — methods: findById, findByName, findByApiKeyHash, create (returns plaintext key once), list, delete (cascades events), revokeKey, regenerateKey.
- [ ] 1.4 Export UserRepository types from `packages/database/src/index.ts`.

## Phase 2: API Auth Middleware

- [x] 2.1 Add `JWT_SECRET` to `ApiConfig` in `apps/api/src/config.ts` — load from env `JWT_SECRET`, default to random string in dev.
- [x] 2.2 Create `apiKeyAuth` middleware in `apps/api/src/middleware/auth.ts` — extract X-API-Key, hash via bcrypt, lookup in users table, attach req.user or return 401. Replace authStub.
- [x] 2.3 Create `jwtAuth` middleware in same file — verify Authorization: Bearer token, attach req.user or return 401 with code INVALID_TOKEN.

## Phase 3: API Routes

- [x] 3.1 Create `apps/api/src/routes/auth.ts` — POST /v1/auth/login: validate name+password, bcrypt compare, sign JWT (1h expiry), return {token, user}.
- [x] 3.2 Create `apps/api/src/routes/users.ts` — GET /v1/users (list, JWT protected), POST /v1/users (create, return api_key once, JWT protected), DELETE /v1/users/:id (cascade, JWT protected), POST /v1/users/:id/key/revoke, POST /v1/users/:id/key/regenerate.
- [x] 3.3 Modify `apps/api/src/routes/events.ts` batch handler — inject req.user.id as actor.userId before insert, overwrite any client-sent userId.
- [x] 3.4 Update `apps/api/src/server.ts` — mount /v1/auth (no auth), /v1/users (jwtAuth), apply apiKeyAuth to /v1/events and /v1/stats. Remove authStub.

## Phase 4: Collector Changes

- [ ] 4.1 Remove `userId` field and `ENV_USER` constant from `packages/opencode-collector/src/domain/config-schema.ts`.
- [ ] 4.2 Remove userId from config resolution in collector infra (ensure no userId is read from env or config).
- [ ] 4.3 Verify collector still sends X-API-Key header on batch requests (no change needed, confirm existing behavior).

## Phase 5: Installer Changes

- [ ] 5.1 Remove `--user` flag from installer CLI.
- [ ] 5.2 Make `--api-key` required in installer.
- [ ] 5.3 Update config writing to exclude userId, include only endpoint + apiKey.

## Phase 6: Dashboard

- [ ] 6.1 Create `apps/dashboard/src/contexts/AuthContext.tsx` — store user+token in localStorage, attach Authorization header to all fetches, login/logout functions, 401 interceptor clears token.
- [ ] 6.2 Create `apps/dashboard/src/pages/LoginPage.tsx` — name+password form, POST /v1/auth/login, redirect to / on success, show error on failure.
- [ ] 6.3 Create `apps/dashboard/src/components/CreateUserModal.tsx` — name input, POST /v1/users, display api_key ONCE with copy button + warning.
- [ ] 6.4 Create `apps/dashboard/src/components/ConfirmDialog.tsx` — reusable confirm modal for revoke/regenerate actions.
- [ ] 6.5 Rewrite `apps/dashboard/src/pages/UsersPage.tsx` — replace analytics table with user management (list users, create button, revoke/regenerate/delete actions per row).
- [ ] 6.6 Update `apps/dashboard/src/components/Layout.tsx` — add logout button, conditionally hide nav items for unauthenticated users.
- [ ] 6.7 Update `apps/dashboard/src/App.tsx` — add /login route, wrap in AuthProvider, remove /users/:userId route.
- [ ] 6.8 Update `apps/dashboard/src/api/client.ts` — attach Authorization header from AuthContext to all API calls.
- [ ] 6.9 Delete `apps/dashboard/src/pages/UserDetailPage.tsx` (analytics user detail no longer needed).

## Phase 7: Testing

- [ ] 7.1 Unit test `apiKeyAuth` — valid key attaches user, missing key returns 401, invalid key returns 401, revoked key returns 401.
- [ ] 7.2 Unit test `jwtAuth` — valid token passes, expired token returns 401, missing header returns 401.
- [ ] 7.3 Unit test login route — valid credentials return JWT, wrong password returns 401, unknown name returns 401, missing fields returns 400.
- [ ] 7.4 Unit test user CRUD routes — create returns api_key once, list excludes sensitive fields, delete cascades, revoke sets hash null, regenerate returns new key.
- [ ] 7.5 Unit test collector config — userId field removed, apiKey still required.
- [ ] 7.6 Integration test — create user → authenticate → send batch events → verify userId injected server-side.
