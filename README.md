# Agent Analytics

Analytics platform for OpenCode agents and skills usage. Tracks agent invocations, skill executions, tool calls, token usage, and costs across your OpenCode sessions.

## Architecture

```
agent-analytics/
├── apps/
│   ├── api/                    # Express REST API (port 3000)
│   └── dashboard/              # React dashboard (port 5173)
├── packages/
│   ├── opencode-collector/     # OpenCode plugin — collects usage events
│   ├── event-schema/           # Zod schemas for usage events
│   ├── database/               # Drizzle ORM + Postgres repository
│   ├── shared/                 # Shared utilities
│   └── installer/              # CLI installer for plugin setup
├── docker/                     # Docker Compose for local dev
└── openspec/                   # SDD specs and change tracking
```

## Quick Start

### Docker (recommended)

```bash
docker compose up --build
```

- **Dashboard**: http://localhost:5173
- **API**: http://localhost:3000/health
- **Database**: localhost:5432 (postgres/postgres)

### Manual Setup

```bash
# Install dependencies
pnpm install

# Start Postgres (via Docker or local)
docker compose up db -d

# Run migrations
cd packages/database
npx drizzle-kit push --force

# Start API
cd apps/api
PORT=3000 DATABASE_URL=postgresql://postgres:postgres@localhost:5432/agent_analytics npx tsx src/main.ts

# Start Dashboard
cd apps/dashboard
npm run dev
```

## Plugin Installation

The OpenCode collector plugin captures usage events from your OpenCode sessions.

### Install the plugin

```bash
npx @agent-analytics/installer
```

Or manually:

1. Copy `.opencode/plugins/analytics.ts` to your project's `.opencode/plugins/`
2. Create `.opencode/analytics.json` in your project root:

```json
{
  "collector": {
    "url": "http://localhost:3000",
    "userId": "your-name"
  }
}
```

### Environment variables

| Variable | Description | Default |
|----------|-------------|---------|
| `OPENCODE_ANALYTICS_URL` | API endpoint URL | — |
| `OPENCODE_ANALYTICS_API_KEY` | API key for authentication | — |
| `OPENCODE_ANALYTICS_USER` | User identifier | `anonymous` |
| `OPENCODE_ANALYTICS_DISABLED` | Set to `true` to disable collection | `false` |

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Health check |
| `POST` | `/v1/events/batch` | Ingest usage events |
| `GET` | `/v1/events` | List events (paginated) |
| `GET` | `/v1/stats/overview` | Aggregate metrics |
| `GET` | `/v1/stats/agents` | Agent stats with avgCost |
| `GET` | `/v1/stats/agents/:name` | Agent detail + version breakdown |
| `GET` | `/v1/stats/skills` | Skill stats (excludes unknown) |
| `GET` | `/v1/stats/skills/:skillName` | Skill detail + version breakdown |
| `GET` | `/v1/stats/users` | User stats |
| `GET` | `/v1/stats/users/:userId` | User detail + recent events |
| `GET` | `/v1/sessions` | Session list (paginated) |
| `GET` | `/v1/sessions/:traceId` | Session detail + events |
| `GET` | `/v1/definitions` | List definitions |
| `GET` | `/v1/definitions/:hash` | Get definition by hash |
| `PUT` | `/v1/definitions/:hash` | Upsert definition |

## Dashboard Pages

- **Overview** (`/`) — Summary metrics, charts, cost breakdown
- **Agents** (`/agents`) — Sortable agent table with avgCost, links to detail
- **Agent Detail** (`/agents/:name`) — Version breakdown, events over time, tokens by skill
- **Skills** (`/skills`) — Sortable skill table with avgCost, links to detail
- **Skill Detail** (`/skills/:skillName`) — Version breakdown, cost over time, definition viewer
- **Users** (`/users`) — User stats table
- **User Detail** (`/users/:userId`) — Token usage, agents used, recent events
- **Events** (`/events`) — Filterable event log
- **Sessions** (`/sessions`) — Session list with agent filter
- **Definitions** (`/definitions`) — Markdown definition viewer

## Development

```bash
# Typecheck
pnpm typecheck

# Lint
pnpm lint

# Test (collector)
npx jest --config packages/opencode-collector/jest.config.js

# Test (API)
npx jest --config apps/api/jest.config.js

# Test (dashboard)
cd apps/dashboard && npx vitest run
```

## Tech Stack

- **Runtime**: Node.js 20+
- **API**: Express + TypeScript
- **Database**: Postgres 16 + Drizzle ORM
- **Dashboard**: React 19 + Vite + Tailwind CSS + Recharts
- **Collector**: OpenCode plugin (hook-based event collection)
- **Schema**: Zod for event validation
- **Testing**: Jest (collector/API), Vitest (dashboard)
