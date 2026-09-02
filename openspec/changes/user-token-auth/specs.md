# Delta: User Token Authentication

## New Domain: User Authentication & Key Management

### Requirement: Users Table Schema

The system SHALL store users in a `users` PostgreSQL table via Drizzle ORM. Columns: `id` (uuid, PK), `name` (text, NOT NULL, UNIQUE), `password_hash` (text, NOT NULL — bcrypt hash of password), `api_key_hash` (text, NULL — bcrypt hash of api_key; NULL when key is revoked), `created_at` (timestamptz, NOT NULL, DEFAULT NOW()), `updated_at` (timestamptz, NOT NULL, DEFAULT NOW()). An index `idx_users_api_key_hash` SHALL exist on `api_key_hash` for fast lookup. The plaintext API key MUST NEVER be stored in the database — it is returned exactly once at creation/regeneration time and then discarded. The plaintext password MUST NEVER be stored — only the bcrypt hash.

#### Scenario: User creation with API key

- GIVEN the system receives a valid user name
- WHEN a user is created via the repository
- THEN a row exists with `id` (uuid), `name`, `api_key_hash` (bcrypt), and timestamps
- AND the plaintext API key is returned in the creation response (once only)
- AND the plaintext key is NOT stored in the database

#### Scenario: Duplicate name rejected

- GIVEN a user with name "alice" already exists
- WHEN creation is attempted with name "alice"
- THEN the insert violates the unique constraint and returns an error

#### Scenario: API key uniqueness enforced

- GIVEN a user with api_key_hash derived from "aa_1234..."
- WHEN another user is created that generates the same api_key (collision)
- THEN the insert violates the unique constraint and returns an error

### Requirement: API Key Generation

The system SHALL generate API keys with format `aa_` prefix + 40 random hex characters (crypto.randomBytes(20).toString('hex')). The plaintext key MUST be returned exactly once at creation/regeneration time. The stored value MUST be the bcrypt hash. The plaintext key MUST NEVER be persisted to disk, database, or logs.

#### Scenario: Key format validation

- GIVEN a generated API key
- WHEN validated
- THEN it matches regex `^aa_[0-9a-f]{40}$`

#### Scenario: Key returned only once on create

- GIVEN a user is created
- WHEN the create response is returned
- THEN the plaintext `api_key` is in the response body
- AND subsequent GET /v1/users responses do NOT include the plaintext key

### Requirement: API Key Revocation

The system SHALL expose `POST /v1/users/:id/key/revoke` that sets `api_key_hash` to NULL for the specified user. A revoked user MUST NOT authenticate via API key until regenerated.

#### Scenario: Revoke disables authentication

- GIVEN a user with a valid API key
- WHEN `POST /v1/users/:id/key/revoke` is called
- THEN `api_key_hash` is NULL in the database
- AND subsequent requests with the old key return 401

#### Scenario: Revoke nonexistent user returns 404

- GIVEN no user with id "nonexistent"
- WHEN `POST /v1/users/nonexistent/key/revoke` is called
- THEN the response is `404 { "error": "User not found", "code": "USER_NOT_FOUND" }`

### Requirement: API Key Regeneration

The system SHALL expose `POST /v1/users/:id/key/regenerate` that generates a new API key, hashes it, stores only the hash, and returns the new plaintext key. The old key is invalidated immediately.

#### Scenario: Regenerate returns new key

- GIVEN a user with an existing API key
- WHEN `POST /v1/users/:id/key/regenerate` is called
- THEN a new plaintext key is returned in the response
- AND the old key no longer works for authentication

#### Scenario: Regenerate nonexistent user returns 404

- GIVEN no user with id "nonexistent"
- WHEN `POST /v1/users/nonexistent/key/regenerate` is called
- THEN the response is `404 { "error": "User not found", "code": "USER_NOT_FOUND" }`

---

## Modified Domain: API Server

### Requirement: Auth Middleware

The system SHALL provide Express middleware that: (1) extracts the `X-API-Key` header from incoming requests, (2) hashes the key via bcrypt, (3) looks up `users.api_key_hash` matching the hash, (4) attaches `req.user = { id, name }` if found, (5) returns `401 { "error": "Invalid or missing API key", "code": "INVALID_API_KEY" }` if not found. The middleware MUST be applied to all `/v1/events/*` and `/v1/stats/*` routes. The middleware MUST NOT apply to `/v1/auth/*` or `/health` routes.

#### Scenario: Valid API key attaches user

- GIVEN a user "alice" with a valid API key
- WHEN a request with `X-API-Key: aa_...` hits `/v1/events/batch`
- THEN `req.user` is `{ id: "uuid", name: "alice" }`
- AND the request proceeds

#### Scenario: Missing API key returns 401

- GIVEN no `X-API-Key` header on the request
- WHEN the request hits `/v1/events/batch`
- THEN the response is `401 { "error": "Invalid or missing API key", "code": "INVALID_API_KEY" }`

#### Scenario: Invalid API key returns 401

- GIVEN a request with `X-API-Key: aa_invalid`
- WHEN the request hits `/v1/stats/agents`
- THEN the response is `401 { "error": "Invalid or missing API key", "code": "INVALID_API_KEY" }`

#### Scenario: Revoked key returns 401

- GIVEN a user whose API key was revoked (hash is NULL)
- WHEN a request with the old key hits a protected route
- THEN the response is `401`

#### Scenario: Auth middleware skips unprotected routes

- GIVEN a request to `GET /health`
- WHEN the request has no API key
- THEN the request proceeds without authentication

### Requirement: Batch Ingestion with userId Injection

The system SHALL modify `POST /v1/events/batch` to extract `req.user.id` from the authenticated API key and inject it as `event.actor.userId` server-side before insertion. Events MUST NOT carry `actor.userId` from the collector — the server is the single source of truth.

#### Scenario: userId injected from API key

- GIVEN a batch of events from user "alice" (authenticated via API key)
- WHEN the events are processed
- THEN each event has `actor.userId` set to alice's user ID
- AND any `actor.userId` from the request body is overwritten

#### Scenario: Unauthenticated batch rejected

- GIVEN no valid API key
- WHEN `POST /v1/events/batch` is called
- THEN the response is `401`

### Requirement: Dashboard Auth — JWT Login

The system SHALL expose `POST /v1/auth/login` accepting `{ "name": string, "password": string }`. The system SHALL verify the password against the bcrypt hash stored for that user. If authentication succeeds, the system returns `{ "token": string, "user": { "id": string, "name": string } }`. The JWT MUST be signed with a server-side secret, include `{ id, name }` as payload, and expire in 1 hour. No refresh token is issued.

#### Scenario: Successful login returns JWT

- GIVEN a user "alice" exists with a valid password
- WHEN `POST /v1/auth/login` with `{ "name": "alice", "password": "correct" }` is called
- THEN the response is `200 { "token": "eyJ...", "user": { "id": "uuid", "name": "alice" } }`
- AND the token is a valid JWT with 1h expiry

#### Scenario: Wrong password returns 401

- GIVEN a user "alice" exists
- WHEN `POST /v1/auth/login` with `{ "name": "alice", "password": "wrong" }` is called
- THEN the response is `401 { "error": "Invalid credentials", "code": "INVALID_CREDENTIALS" }`

#### Scenario: Unknown name returns 401

- GIVEN no user with name "bob"
- WHEN `POST /v1/auth/login` with `{ "name": "bob", "password": "any" }` is called
- THEN the response is `401 { "error": "Invalid credentials", "code": "INVALID_CREDENTIALS" }`

#### Scenario: Missing fields returns 400

- GIVEN a request body `{ "name": "alice" }` (no password)
- WHEN `POST /v1/auth/login` is called
- THEN the response is `400 { "error": "Validation failed", "code": "VALIDATION_ERROR" }`

### Requirement: Dashboard Auth — JWT Verification

The system SHALL provide Express middleware that verifies the `Authorization: Bearer <token>` header on dashboard-protected routes (`/v1/users`, `/v1/auth/login` is excluded). Invalid or expired tokens MUST return `401 { "error": "Invalid or expired token", "code": "INVALID_TOKEN" }`.

#### Scenario: Valid JWT passes middleware

- GIVEN a valid JWT for user "alice"
- WHEN a request with `Authorization: Bearer <token>` hits `/v1/users`
- THEN the request proceeds with `req.user` set

#### Scenario: Expired JWT returns 401

- GIVEN a JWT that expired 1 hour ago
- WHEN the request hits `/v1/users`
- THEN the response is `401 { "error": "Invalid or expired token", "code": "INVALID_TOKEN" }`

#### Scenario: Missing Authorization header returns 401

- GIVEN no Authorization header
- WHEN the request hits `/v1/users`
- THEN the response is `401`

### Requirement: User CRUD Endpoints

The system SHALL expose:
- `GET /v1/users` — returns `[{ id, name, createdAt, updatedAt }]` (NO api_key or password_hash in response). Protected by JWT.
- `POST /v1/users` — accepts `{ "name": string, "password": string }`, returns `201 { id, name, api_key, createdAt }`. The `api_key` is returned ONCE in the response (not stored in DB). The password is hashed with bcrypt before storage. Protected by JWT.
- `DELETE /v1/users/:id` — deletes user and their events. Returns `204`. Protected by JWT.

#### Scenario: List users excludes sensitive data

- GIVEN 3 users exist
- WHEN `GET /v1/users` is called
- THEN 3 entries are returned, none containing `api_key_hash` or `password_hash`

#### Scenario: Create user returns API key once

- GIVEN a request `{ "name": "alice", "password": "secure123" }`
- WHEN `POST /v1/users` is called
- THEN the response is `201 { "id": "uuid", "name": "alice", "api_key": "aa_...", "createdAt": "..." }`
- AND the api_key is returned in the response but NOT stored in the database
- AND the password_hash is stored (bcrypt hash of "secure123")
- AND subsequent GET responses do NOT include the api_key or password_hash

#### Scenario: Create duplicate name returns 409

- GIVEN user "alice" exists
- WHEN `POST /v1/users` with `{ "name": "alice" }` is called
- THEN the response is `409 { "error": "User already exists", "code": "USER_EXISTS" }`

#### Scenario: Delete user cascades

- GIVEN user "alice" with id "u1" and events with `actor.userId = "u1"`
- WHEN `DELETE /v1/users/u1` is called
- THEN the user row is deleted
- AND events with `actor.userId = "u1"` are deleted
- AND the response is `204`

#### Scenario: Delete nonexistent user returns 404

- GIVEN no user with id "nonexistent"
- WHEN `DELETE /v1/users/nonexistent` is called
- THEN the response is `404`

### Requirement: Error Response Format

All API error responses MUST follow the shape `{ "error": string, "code": string }`. Error codes: `INVALID_API_KEY`, `INVALID_TOKEN`, `USER_NOT_FOUND`, `USER_EXISTS`, `VALIDATION_ERROR`, `INTERNAL_ERROR`.

#### Scenario: Error shape consistency

- GIVEN any error condition
- WHEN the API responds with an error
- THEN the body contains exactly `error` (human-readable message) and `code` (machine-readable code)

---

## Modified Domain: Usage Collector

### Requirement: Remove userId from Collector Config

The collector config schema SHALL remove the `userId` field and the `OPENCODE_ANALYTICS_USER` environment variable. The `apiKey` field and `X-API-Key` header sending MUST remain unchanged.

#### Scenario: Config without userId

- GIVEN a collector config with only `endpoint` and `apiKey`
- WHEN the collector starts
- THEN it initializes successfully without userId

#### Scenario: OPENCODE_ANALYTICS_USER ignored

- GIVEN `OPENCODE_ANALYTICS_USER=alice` in environment
- WHEN the collector starts
- THEN the env var is not read; the collector has no userId concept

### Requirement: Events No Longer Carry actor.userId from Config

The collector SHALL NOT set `actor.userId` on any event. The field MAY be absent or empty in the emitted event — the server injects it from the API key.

#### Scenario: Emitted event has no userId

- GIVEN the collector maps a session event
- WHEN the event is emitted
- THEN `actor.userId` is either absent or empty string
- AND the server-side injection overrides it

### Requirement: Collector Sends X-API-Key Header

The collector MUST include `X-API-Key: <apiKey>` on all `POST /v1/events/batch` requests. The header value is the plaintext API key from config.

#### Scenario: API key header present

- GIVEN a collector configured with `apiKey: "aa_1234..."`
- WHEN events are flushed
- THEN the POST request includes `X-API-Key: aa_1234...`

---

## Modified Domain: Dashboard UI

### Requirement: Login Page

The dashboard SHALL include a `/login` route with a form accepting a name input and a "Login" button. On submit, the form calls `POST /v1/auth/login`. On success, the JWT is stored in `localStorage` and the user is redirected to `/`. On failure, an error message is shown. Unauthenticated users accessing any route SHALL be redirected to `/login`.

#### Scenario: Successful login redirects to home

- GIVEN a user "alice" exists
- WHEN the login form submits `{ "name": "alice" }`
- THEN the JWT is stored in localStorage
- AND the user is redirected to `/`

#### Scenario: Failed login shows error

- GIVEN no user "bob"
- WHEN the login form submits `{ "name": "bob" }`
- THEN an error message "User not found" is displayed

#### Scenario: Unauthenticated redirect

- GIVEN no JWT in localStorage
- WHEN the user navigates to `/`
- THEN the user is redirected to `/login`

### Requirement: Auth Context

The dashboard SHALL provide a React context (`AuthContext`) that: (1) stores the current user and JWT, (2) attaches `Authorization: Bearer <token>` to all API requests, (3) exposes `login(name)` and `logout()` functions, (4) clears the token on 401 responses.

#### Scenario: API requests include auth header

- GIVEN a logged-in user with a JWT
- WHEN the dashboard makes any `/v1/*` request
- THEN the request includes `Authorization: Bearer <token>`

#### Scenario: 401 triggers logout

- GIVEN a user with an expired JWT
- WHEN an API request returns 401
- THEN the JWT is cleared from localStorage
- AND the user is redirected to `/login`

### Requirement: User Management Page

The dashboard SHALL include a `/users` route (replacing the analytics user stats page) that displays a table of users. Columns: Name, Created, Actions (Revoke, Regenerate, Delete). Each row shows the user name and creation date. A "Create User" button opens a modal.

#### Scenario: User list loads from API

- GIVEN 5 users exist
- WHEN the user navigates to `/users`
- THEN a table renders with 5 rows showing name, created date, and action buttons

#### Scenario: Empty state

- GIVEN no users exist
- WHEN the user navigates to `/users`
- THEN a "No users yet" message with a "Create User" button is shown

### Requirement: Create User Modal

The dashboard SHALL show a modal when "Create User" is clicked. The modal has a name input and "Create" button. On success, the modal displays the API key ONCE with a "Copy to Clipboard" button and a warning: "This key will not be shown again." The user MUST dismiss the modal manually.

#### Scenario: Create and show API key

- GIVEN the create user modal is open
- WHEN the user enters "alice" and clicks Create
- THEN a new modal shows the API key `aa_...` with a copy button
- AND a warning message is displayed

#### Scenario: Copy to clipboard

- GIVEN the API key is displayed in the modal
- WHEN the user clicks the copy button
- THEN the API key is copied to the clipboard
- AND a "Copied!" confirmation is shown

### Requirement: Revoke/Regenerate Confirmation Dialogs

Before revoking or regenerating an API key, the dashboard SHALL show a confirmation dialog. Revoke dialog: "Revoke API key for {name}? They will no longer be able to send events." Regenerate dialog: "Regenerate API key for {name}? The old key will stop working immediately."

#### Scenario: Revoke confirmation

- GIVEN the user clicks Revoke on user "alice"
- WHEN the confirmation dialog appears
- THEN the dialog shows "Revoke API key for alice?"
- AND the user can confirm or cancel

#### Scenario: Regenerate confirmation

- GIVEN the user clicks Regenerate on user "alice"
- WHEN the confirmation dialog appears
- THEN the dialog shows "Regenerate API key for alice?"
- AND the user can confirm or cancel
- AND on confirm, a new key is shown with copy button

### Requirement: Remove Analytics User Pages

The existing `/users` route for analytics user stats (userId, eventCount, tokens, cost) SHALL be removed. The `/users/:userId` detail page SHALL be removed. These are replaced by the user management page.

#### Scenario: Old user stats route removed

- GIVEN the dashboard is loaded
- WHEN the user navigates to `/users`
- THEN the user management page is shown (not analytics user stats)

---

## Modified Domain: Database Migration

### Requirement: Users Table Migration

A Drizzle migration SHALL create the `users` table with columns: `id` (uuid PK), `name` (text UNIQUE NOT NULL), `password_hash` (text NOT NULL — bcrypt hash of password), `api_key_hash` (text, NULL when revoked), `created_at` (timestamptz DEFAULT NOW()), `updated_at` (timestamptz DEFAULT NOW()). Indexes: `idx_users_api_key_hash` on `api_key_hash`. The migration MUST be idempotent-safe. The plaintext API key and password MUST NEVER be stored in the database.

#### Scenario: Up migration creates users table

- GIVEN a clean database
- WHEN the up migration runs
- THEN the `users` table exists with all columns and indexes

#### Scenario: Down migration drops users table

- GIVEN the `users` table exists
- WHEN the down migration runs
- THEN the table is removed

### Requirement: Clean Data Migration

The migration SHALL delete all existing rows from `usage_events` via `DELETE FROM usage_events`. This is a destructive clean-slate migration (pre-production). The system SHALL add an index on `actor->>'userId'` for efficient user-scoped queries.

#### Scenario: Existing events deleted

- GIVEN 1000 rows in `usage_events`
- WHEN the migration runs
- THEN `usage_events` has 0 rows

#### Scenario: userId index created

- GIVEN the migration has run
- WHEN querying `usage_events` with `WHERE actor->>'userId' = 'u1'`
- THEN the query uses the new index

---

## API Contracts Summary

### TypeScript Types

```typescript
// Request/Response shapes

// POST /v1/auth/login
interface LoginRequest { name: string }
interface LoginResponse { token: string; user: { id: string; name: string } }

// GET /v1/users
interface UserListItem { id: string; name: string; createdAt: string; updatedAt: string }

// POST /v1/users
interface CreateUserRequest { name: string }
interface CreateUserResponse { id: string; name: string; api_key: string; createdAt: string }

// POST /v1/users/:id/key/revoke
interface RevokeKeyResponse { success: true }

// POST /v1/users/:id/key/regenerate
interface RegenerateKeyResponse { api_key: string }

// DELETE /v1/users/:id
// Response: 204 No Content

// Error
interface ErrorResponse { error: string; code: string }
```

### Drizzle Schema Additions

```typescript
import { pgTable, index, text, timestamp, uuid } from 'drizzle-orm/pg-core';

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
```

### HTTP Headers

| Header | Value | Used By |
|--------|-------|---------|
| `X-API-Key` | `aa_` + 40 hex chars | Collector → API (all protected routes) |
| `Authorization` | `Bearer <JWT>` | Dashboard → API (user management routes) |
