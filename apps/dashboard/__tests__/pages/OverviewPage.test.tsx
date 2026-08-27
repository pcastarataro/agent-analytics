import { render, screen, waitFor, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { OverviewPage } from '../../src/pages/OverviewPage';
import { CostByAgent } from '../../src/pages/OverviewPage/CostByAgent';
import type { StatsOverview, AgentStat } from '../../src/api/types';

vi.stubGlobal('fetch', vi.fn());
const mockFetch = vi.mocked(globalThis.fetch);

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const overviewData: StatsOverview = {
  usage: { totalEvents: 42, distinctSessions: 10, distinctExecutions: 15, agentInvocations: 35, skillInvocations: 20, toolCalls: 25 },
  performance: { totalDurationMs: 5000, avgDurationMs: 200, totalInputTokens: 8000, totalOutputTokens: 4000, totalCachedTokens: 1000, totalCost: 1.5, avgCost: 0.06 },
  quality: { successCount: 35, errorCount: 7, cancelledCount: 0, totalRetries: 2, successRate: 83.3, errorRate: 16.7 },
  evolution: { byAgentVersion: [], bySkillVersion: [] },
  byAgent: { alpha: 30, beta: 12 },
  byStatus: { success: 35, error: 7 },
  byDate: { '2025-01-15': 20, '2025-01-16': 22 },
};

const agentStats: AgentStat[] = [
  { agentName: 'alpha', version: '1.0', executionCount: 30, successRate: 90, avgDurationMs: 150, totalCost: 0.0123 },
  { agentName: 'beta', version: '1.0', executionCount: 12, successRate: 85, avgDurationMs: 200, totalCost: 0.0045 },
];

function mockOk(data: unknown) {
  mockFetch.mockResolvedValue({
    ok: true,
    json: () => Promise.resolve(data),
  } as Response);
}

function mockError(status: number, statusText: string) {
  mockFetch.mockResolvedValue({
    ok: false,
    status,
    statusText,
  } as Response);
}

function mockOverviewAndAgents() {
  mockFetch.mockImplementation((url: string | URL | Request | undefined) => {
    const urlStr = String(url);
    if (urlStr.includes('/v1/stats/agents')) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ data: agentStats }),
      } as Response);
    }
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve(overviewData),
    } as Response);
  });
}

describe('OverviewPage', () => {
  it('shows loading spinner initially', () => {
    mockFetch.mockReturnValue(new Promise(() => {}));
    render(<OverviewPage />);
    expect(screen.getByText('Loading…')).toBeDefined();
  });

  it('renders metric sections and charts from mock data', async () => {
    mockOverviewAndAgents();
    render(<OverviewPage />);

    await waitFor(() => {
      expect(screen.getAllByText('42').length).toBeGreaterThanOrEqual(1);
    });

    expect(screen.getAllByText('Total Events').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Sessions')).toBeDefined();
    expect(screen.getByText('Usage')).toBeDefined();
    expect(screen.getByText('Performance')).toBeDefined();
    expect(screen.getByText('Quality')).toBeDefined();
    expect(screen.getByText('Events by Agent')).toBeDefined();
    expect(screen.getByText('Cost by Agent')).toBeDefined();
    expect(screen.getByText('Events Over Time')).toBeDefined();
  });

  it('shows empty state when totalEvents is 0', async () => {
    mockOk({
      ...overviewData,
      usage: { ...overviewData.usage, totalEvents: 0 },
    });
    render(<OverviewPage />);

    await waitFor(() => {
      expect(screen.getByText('No events yet')).toBeDefined();
    });
  });

  it('shows error with retry on API failure', async () => {
    mockError(500, 'Internal Server Error');
    render(<OverviewPage />);

    await waitFor(() => {
      expect(screen.getByText('API 500: Internal Server Error')).toBeDefined();
    });

    expect(screen.getByRole('button', { name: 'Retry' })).toBeDefined();
  });
});

describe('CostByAgent', () => {
  it('renders chart with data', () => {
    const { container } = render(<CostByAgent data={agentStats} />);
    expect(screen.getByText('Cost by Agent')).toBeDefined();
    expect(container.querySelector('.recharts-responsive-container')).not.toBeNull();
  });

  it('shows empty state when data is empty', () => {
    render(<CostByAgent data={[]} />);
    expect(screen.getByText('Cost by Agent')).toBeDefined();
    expect(screen.getByText('No cost data')).toBeDefined();
  });

  it('filters out agents with zero cost', () => {
    const dataWithZero: AgentStat[] = [
      { agentName: 'gamma', version: '1.0', executionCount: 5, successRate: 100, avgDurationMs: 100, totalCost: 0 },
      { agentName: 'alpha', version: '1.0', executionCount: 30, successRate: 90, avgDurationMs: 150, totalCost: 0.0123 },
    ];
    const { container } = render(<CostByAgent data={dataWithZero} />);
    expect(screen.getByText('Cost by Agent')).toBeDefined();
    expect(container.querySelector('.recharts-responsive-container')).not.toBeNull();
  });

  it('shows empty state when all agents have zero cost', () => {
    const allZero: AgentStat[] = [
      { agentName: 'gamma', version: '1.0', executionCount: 5, successRate: 100, avgDurationMs: 100, totalCost: 0 },
    ];
    render(<CostByAgent data={allZero} />);
    expect(screen.getByText('No cost data')).toBeDefined();
  });
});
