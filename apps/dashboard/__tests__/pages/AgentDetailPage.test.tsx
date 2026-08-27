import { render, screen, waitFor, cleanup } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { AgentDetailPage } from '../../src/pages/AgentDetailPage';
import type { AgentDetail, UsageEventDTO } from '../../src/api/types';

vi.stubGlobal('fetch', vi.fn());
const mockFetch = vi.mocked(globalThis.fetch);

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function makeEvent(overrides: Partial<UsageEventDTO> = {}): UsageEventDTO {
  return {
    id: '0192e000-1000-7000-8000-000000000001',
    actor: { userId: 'user-1' },
    project: {},
    session: {},
    execution: { traceId: 'trace-1' },
    agent: { name: 'alpha' },
    skill: { name: 'sdd-apply' },
    tool: {},
    model: {},
    metrics: { inputTokens: 50, outputTokens: 100, cost: 0.01 },
    result: { status: 'success' },
    timestamp: '2025-01-15T10:00:00Z',
    ...overrides,
  };
}

const agentData: AgentDetail = {
  agentName: 'alpha',
  totalEvents: 2,
  successRate: 95.0,
  avgDurationMs: 320,
  totalCost: 1.23,
  avgCost: 0.615,
  totalInputTokens: 70,
  totalOutputTokens: 130,
  totalCachedTokens: 20,
  distinctVersions: 2,
  byVersion: [
    { version: '1.0.0', executionCount: 1, successRate: 100, totalCost: 0.01 },
    { version: '1.1.0', executionCount: 1, successRate: 100, totalCost: 0.005 },
  ],
  eventsOverTime: [
    { date: '2025-01-15', count: 2 },
  ],
  tokensBySkill: [
    { name: 'sdd-apply', tokens: 150 },
    { name: 'pr-review', tokens: 50 },
  ],
  recentEvents: [
    makeEvent({ skill: { name: 'sdd-apply', version: '1.0.0' }, metrics: { inputTokens: 50, outputTokens: 100, cost: 0.01 } }),
    makeEvent({ id: 'evt-2', skill: { name: 'pr-review', version: '1.1.0' }, metrics: { inputTokens: 20, outputTokens: 30, cost: 0.005 } }),
  ],
};

function renderAgentPage(agentName = 'alpha') {
  return render(
    <MemoryRouter initialEntries={[`/agents/${agentName}`]}>
      <Routes>
        <Route path="/agents/:name" element={<AgentDetailPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('AgentDetailPage', () => {
  it('shows loading spinner initially', () => {
    mockFetch.mockReturnValue(new Promise(() => {}));
    renderAgentPage();

    expect(screen.getByText('Loading…')).toBeDefined();
  });

  it('renders agent name and charts from mock data', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(agentData),
    } as Response);

    renderAgentPage();

    await waitFor(() => {
      expect(screen.getByText('alpha')).toBeDefined();
    });

    expect(screen.getByText('Total Events')).toBeDefined();
    expect(screen.getByText('Tokens by Skill')).toBeDefined();
    expect(screen.getByText('Events Over Time')).toBeDefined();
    expect(screen.getByText('Recent Events')).toBeDefined();
    expect(screen.getByText('Distinct Versions')).toBeDefined();
  });

  it('shows error on API failure', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 404,
      statusText: 'Not Found',
    } as Response);

    renderAgentPage();

    await waitFor(() => {
      expect(screen.getByText('API 404: Not Found')).toBeDefined();
    });
  });

  it('has a back link to agents', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(agentData),
    } as Response);

    renderAgentPage();

    await waitFor(() => {
      expect(screen.getByText('← Agents')).toBeDefined();
    });
  });

  it('renders version breakdown table with byVersion data', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(agentData),
    } as Response);

    renderAgentPage();

    await waitFor(() => {
      expect(screen.getByText('Version Breakdown')).toBeDefined();
    });

    // Versions appear in both breakdown table and recent events
    expect(screen.getAllByText('1.0.0').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('1.1.0').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Distinct Versions')).toBeDefined();
  });

  it('renders version column in recent events table', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(agentData),
    } as Response);

    renderAgentPage();

    await waitFor(() => {
      expect(screen.getByText('Recent Events')).toBeDefined();
    });

    // Version column header should be present (appears in both breakdown and events tables)
    const versionElements = screen.getAllByText('Version');
    expect(versionElements.length).toBeGreaterThanOrEqual(2);
  });
});
