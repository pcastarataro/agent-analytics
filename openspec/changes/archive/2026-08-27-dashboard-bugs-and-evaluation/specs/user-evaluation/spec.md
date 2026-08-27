# User Evaluation Specification

## Purpose

Provides user-level aggregation of agent and skill usage across the analytics platform. Enables operators to understand which users are most active, which agents/skills they use, and their overall consumption patterns.

## Requirements

### Requirement: User Activity Aggregation

The system MUST aggregate `UsageEvent` records by `actor.userId`. Each user entry SHALL include: `userId`, `eventCount`, `distinctAgents` (count of unique `agentName` values), `distinctSkills` (count of unique `skillName` values), `firstSeenAt` (earliest `timestamp`), and `lastSeenAt` (latest `timestamp`).

#### Scenario: Single user with multiple agents

- GIVEN 20 events from user "u1" using agents "alpha" and "beta"
- WHEN user aggregation is computed
- THEN user "u1" has eventCount=20, distinctAgents=2, distinctSkills derived from events

#### Scenario: Multiple users sorted by activity

- GIVEN users "u1" (50 events), "u2" (10 events), "u3" (30 events)
- WHEN user stats are returned
- THEN users are ordered by eventCount descending: u1, u3, u2

#### Scenario: Time range for first/last seen

- GIVEN user "u1" with events from Jan 1 to Jan 15
- WHEN user stats are computed
- THEN firstSeenAt is Jan 1 and lastSeenAt is Jan 15

### Requirement: Unknown User Handling

Events where `actor.userId` is null, empty, or undefined MUST aggregate under a synthetic userId `"unknown"`. The `"unknown"` row SHALL appear in results like any other user.

#### Scenario: Mixed known and unknown users

- GIVEN 30 events with userId "u1" and 10 events with no userId
- WHEN user stats are returned
- THEN two entries exist: "u1" with count 30, "unknown" with count 10

#### Scenario: All events unknown

- GIVEN 20 events with no userId
- WHEN user stats are returned
- THEN one entry exists: "unknown" with count 20

### Requirement: User Stats API Contract

The `GET /v1/stats/users` endpoint MUST return `{ data: UserStat[], nextCursor: string | null }`. Each `UserStat` MUST include the fields defined in User Activity Aggregation. Pagination MAY be supported for large user bases; if no cursor is provided, the first page SHALL be returned.

#### Scenario: Paginated user stats

- GIVEN 100 distinct users and page size 50
- WHEN `GET /v1/stats/users?limit=50` is called
- THEN 50 users are returned and `nextCursor` is non-null

#### Scenario: Empty user stats

- GIVEN no events in the database
- WHEN `GET /v1/stats/users` is called
- THEN the response is `{ data: [], nextCursor: null }`

### Requirement: Dashboard User Evaluation Display

The dashboard `/users` route SHALL render a sortable table of user stats. Columns SHALL include: userId, event count, distinct agents, distinct skills, first seen, last seen. The table SHALL support sorting by any column. Default sort SHALL be event count descending.

#### Scenario: Table renders user data

- GIVEN `/v1/stats/users` returns 5 users
- WHEN the user navigates to `/users`
- THEN a table with 5 rows is displayed

#### Scenario: Sort by distinct agents

- GIVEN users with varying agent counts
- WHEN the user clicks the Agents column header
- THEN the table re-sorts by distinct agents descending

#### Scenario: Unknown user displayed

- GIVEN events aggregated under "unknown"
- WHEN the table renders
- THEN a row with userId "unknown" is visible
