import { render, screen, waitFor, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { OverviewPage } from '../../src/pages/OverviewPage';
import type { StatsOverview } from '../../src/api/types';

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

function mockOk(data: StatsOverview) {
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

describe('OverviewPage', () => {
  it('shows loading spinner initially', () => {
    mockFetch.mockReturnValue(new Promise(() => {}));
    render(<OverviewPage />);
    expect(screen.getByText('Loading…')).toBeDefined();
  });

  it('renders metric sections and charts from mock data', async () => {
    mockOk(overviewData);
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
    expect(screen.getByText('Events by Status')).toBeDefined();
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
