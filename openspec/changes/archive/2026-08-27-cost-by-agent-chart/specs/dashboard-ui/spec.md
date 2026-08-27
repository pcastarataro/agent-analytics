# Delta for Dashboard UI

## ADDED Requirements

### Requirement: Cost By Agent Chart

The Overview Page SHALL include a horizontal bar chart displaying `totalCost` per agent. The chart SHALL use recharts `BarChart` with `layout="vertical"`. The y-axis SHALL display agent names. The x-axis SHALL display cost values formatted as USD (`$X.XXXX`). Data SHALL come from `GET /v1/stats/agents`.

#### Scenario: Renders cost bars per agent

- GIVEN `/v1/stats/agents` returns agents with `totalCost` values
- WHEN the Overview page loads
- THEN a horizontal bar chart renders with one bar per agent
- AND each bar label shows the agent name on the y-axis
- AND each bar length reflects `totalCost` on the x-axis

#### Scenario: Cost formatted as USD

- GIVEN an agent with `totalCost: 12.3456`
- WHEN the chart renders
- THEN the cost axis label shows "$12.3456"

#### Scenario: Empty state when no agents or zero cost

- GIVEN `/v1/stats/agents` returns no agents or all agents have zero cost
- WHEN the Overview page loads
- THEN a "No cost data" message is displayed instead of the chart

#### Scenario: Zero-cost agents excluded from chart

- GIVEN agents where some have `totalCost: 0`
- WHEN the chart renders
- THEN agents with zero cost are not shown as bars

## MODIFIED Requirements

### Requirement: Overview Page

The Overview Page SHALL display (1) a total-events count card, (2) a bar chart of events grouped by agent name, and (3) a horizontal bar chart of cost grouped by agent name. Data for the events count and agent bar chart SHALL come from `GET /v1/stats/overview`. Data for the cost bar chart SHALL come from `GET /v1/stats/agents`.

(Previously: displayed a donut chart of events grouped by status instead of the cost bar chart)

#### Scenario: Renders overview data from API

- GIVEN `/v1/stats/overview` returns `{ totalEvents: 42, byAgent: [...] }`
- WHEN the user navigates to `/`
- THEN the total-events card displays "42"
- AND a bar chart renders with one bar per agent

#### Scenario: Renders cost chart from agents endpoint

- GIVEN `/v1/stats/agents` returns agents with cost data
- WHEN the user navigates to `/`
- THEN a horizontal cost-by-agent bar chart renders below the events charts

#### Scenario: Empty state when no events exist

- GIVEN `/v1/stats/overview` returns `{ totalEvents: 0 }`
- WHEN the user navigates to `/`
- THEN an empty-state message is displayed instead of charts

## REMOVED Requirements

### Requirement: EventsByStatus Donut Chart

(Reason: The status donut chart on the Overview Page provides limited actionable insight. It is replaced by the Cost By Agent horizontal bar chart which better serves spending distribution analysis.)
(Migration: None — component is deleted, no external consumers.)
