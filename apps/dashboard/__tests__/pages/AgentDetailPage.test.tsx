import { render, screen, waitFor, cleanup } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { AgentDetailPage } from '../../src/pages/AgentDetailPage';
import type { AgentEventsResponse } from '../../src/pages/AgentDetailPage';
import type { UsageEventDTO } from '../../src/api/types';

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
    metrics: { inputTokens: 50, outputTokens: 100 },
    result: { status: 'success' },
    timestamp: '2025-01-15T10:00:00Z',
    ...overrides,
  };
}

const agentData: AgentEventsResponse = {
  events: [
    makeEvent({ skill: { name: 'sdd-apply' }, metrics: { inputTokens: 50, outputTokens: 100 } }),
    makeEvent({ id: 'evt-2', skill: { name: 'pr-review' }, metrics: { inputTokens: 20, outputTokens: 30 } }),
  ],
  stats: { total: 2, byAgent: { alpha: 2 }, byStatus: { success: 2 }, byDate: { '2025-01-15': 2 } },
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
    expect(screen.getByText('2')).toBeDefined();
    expect(screen.getByText('Tokens by Skill')).toBeDefined();
    expect(screen.getByText('Events Over Time')).toBeDefined();
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

  it('has a back link to events', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(agentData),
    } as Response);

    renderAgentPage();

    await waitFor(() => {
      expect(screen.getByText('← Events')).toBeDefined();
    });
  });
});
