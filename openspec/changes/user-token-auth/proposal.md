# Proposal: User Token Authentication

## Intent

The project currently uses a free-form `userId` string configured in the collector, with a no-op auth middleware. This change introduces API key-based authentication: admins manage users and keys via the dashboard, the collector sends an API key instead of userId, and the server resolves the user from the key. This is a prerequisite for any multi-user or billing feature.

## Scope

### In Scope
- `users` table with id, name, api_key_hash, timestamps (plaintext key returned once, never stored)
- Auth middleware: validate `X-API-Key` header against hashed keys in DB
- API routes: user CRUD (`/v1/users`), key revoke/regenerate, dashboard login (`/v1/auth/login`)
- Collector change: remove `userId` config, keep `apiKey`, server injects userId
- Installer change: remove `--user`, require `--api-key`, write to analytics.json
- Dashboard: login page, user management page (list, create, copy key, revoke/regenerate)
- Clean migration: delete all existing userId data (not production yet)
- JWT for dashboard auth

### Out of Scope
- Per-user data isolation (admins see everything)
- Role-based access control
- API key rotation policies or expiry
- Production data migration strategy
- Rate limiting per API key

## Capabilities

### New Capabilities
- `user-auth`: API key authentication, user management CRUD, dashboard login/session
- `key-management`: API key generation, hashing, revocation, regeneration

### Modified Capabilities
- `api-server`: Auth middleware added; events endpoint injects userId from API key; user stats aggregation joins on users table
- `usage-collector`: Remove userId config/env; keep apiKey; events no longer carry actor.userId from config
- `dashboard-ui`: Login page, user management page, remove userId-based routing

## Approach

- **API key format**: prefix `aa_` + 40 random hex chars, stored as bcrypt hash in DB
- **Auth middleware**: extract `X-API-Key` → hash → lookup in `users` table → attach `req.user`
- **JWT**: sign on login (`POST /v1/auth/login` with name), verify on dashboard routes; short-lived (1h), no refresh token
- **Migration**: single Drizzle migration creating `users` table; DROP existing events data via `DELETE FROM usage_events`; add index on `actor->>'userId'`
- **Collector**: remove `userId` from config schema and env resolution; keep `apiKey` as-is

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `packages/database` | Modified | New `users` table, migration, index |
| `apps/api` | Modified | Auth middleware, user routes, login route, events userId injection |
| `packages/opencode-collector` | Modified | Remove userId config, keep apiKey |
| `packages/installer` | Modified | Remove --user, require --api-key |
| `apps/dashboard` | Modified | Login page, user management page, auth context |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Breaking collector for existing users | High | Clean migration deletes old data; both changes ship together |
| API key leak in transit | Low | HTTPS enforced; keys hashed at rest; dashboard copies to clipboard only |
| JWT token theft | Low | Short-lived tokens; HTTPS only; no refresh token |

## Rollback Plan

1. Revert collector changes (restore userId config)
2. Drop `users` table via down migration
3. Restore old events from backup if needed
4. Revert dashboard auth changes

## Dependencies

- None external; bcrypt library needed for key hashing

## Success Criteria

- [ ] Admin can log in to dashboard with a name
- [ ] Admin can create users, see API keys, copy to clipboard, revoke/regenerate
- [ ] Collector sends API key in `X-API-Key` header
- [ ] API resolves user from key, injects userId server-side
- [ ] Reports show username (not raw userId)
- [ ] Old userId data is deleted; system starts clean
- [ ] All existing tests pass after migration
