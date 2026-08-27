import { render, screen, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AgentDetailPage } from './AgentDetailPage';

// Mock useApi
vi.mock('../hooks/useApi', () => ({
  useApi: vi.fn(),
}));

import { useApi } from '../hooks/useApi';

const mockUseApi = vi.mocked(useApi);

const mockAgentDetail = {
  agentName: 'my-agent',
  totalEvents: 120,
  successRate: 95.5,
  avgDurationMs: 342,
  totalCost: 1.2345,
  avgCost: 0.0103,
  totalInputTokens: 50000,
  totalOutputTokens: 12000,
  totalCachedTokens: 8000,
  eventsOverTime: [
    { date: '2025-01-01', count: 30 },
    { date: '2025-01-02', count: 45 },
  ],
  tokensBySkill: [
    { name: 'code-review', tokens: 20000 },
    { name: 'refactor', tokens: 15000 },
  ],
  recentEvents: [
    {
      id: 'e1',
      actor: { userId: 'u1' },
      project: {},
      session: {},
      execution: { traceId: 'trace-1' },
      agent: { name: 'my-agent' },
      skill: { name: 'code-review' },
      tool: {},
      model: {},
      metrics: { inputTokens: 500, outputTokens: 200, cost: 0.012 },
      result: { status: 'success' as const },
      timestamp: '2025-01-02T10:00:00Z',
    },
  ],
};

function renderWithRouter(ui: React.ReactElement, route = '/agents/my-agent') {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <Routes>
        <Route path="/agents/:name" element={ui} />
        <Route path="/agents" element={<div>Agents List</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('AgentDetailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('shows loading state', () => {
    mockUseApi.mockReturnValue({ data: null, loading: true, error: null, refetch: vi.fn() });
    renderWithRouter(<AgentDetailPage />);
    expect(screen.getByText('Loading…')).toBeDefined();
  });

  it('shows error state', () => {
    mockUseApi.mockReturnValue({
      data: null,
      loading: false,
      error: new Error('Not found'),
      refetch: vi.fn(),
    });
    renderWithRouter(<AgentDetailPage />);
    expect(screen.getByText('Not found')).toBeDefined();
  });

  it('renders agent name and back link', () => {
    mockUseApi.mockReturnValue({
      data: mockAgentDetail,
      loading: false,
      error: null,
      refetch: vi.fn(),
    });

    renderWithRouter(<AgentDetailPage />);
    expect(screen.getByText('my-agent')).toBeDefined();
    expect(screen.getByText('← Agents')).toBeDefined();
  });

  it('renders stat cards with correct values', () => {
    mockUseApi.mockReturnValue({
      data: mockAgentDetail,
      loading: false,
      error: null,
      refetch: vi.fn(),
    });

    renderWithRouter(<AgentDetailPage />);
    expect(screen.getByText('$1.2345')).toBeDefined();
    expect(screen.getByText('95.5%')).toBeDefined();
    expect(screen.getByText('342 ms')).toBeDefined();
    expect(screen.getByText('120')).toBeDefined();
  });

  it('renders token breakdown', () => {
    mockUseApi.mockReturnValue({
      data: mockAgentDetail,
      loading: false,
      error: null,
      refetch: vi.fn(),
    });

    renderWithRouter(<AgentDetailPage />);
    expect(screen.getByText('50,000 in')).toBeDefined();
    expect(screen.getByText('12,000 out · 8,000 cached')).toBeDefined();
  });

  it('renders recent events table', () => {
    mockUseApi.mockReturnValue({
      data: mockAgentDetail,
      loading: false,
      error: null,
      refetch: vi.fn(),
    });

    renderWithRouter(<AgentDetailPage />);
    expect(screen.getByText('Recent Events')).toBeDefined();
    expect(screen.getByText('code-review')).toBeDefined();
    expect(screen.getByText('success')).toBeDefined();
  });
});
