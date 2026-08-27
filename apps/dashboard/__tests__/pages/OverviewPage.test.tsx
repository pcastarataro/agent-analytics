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
  total: 42,
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

  it('renders stats card and charts from mock data', async () => {
    mockOk(overviewData);
    render(<OverviewPage />);

    await waitFor(() => {
      expect(screen.getByText('42')).toBeDefined();
    });

    expect(screen.getByText('Total Events')).toBeDefined();
    expect(screen.getByText('Events by Agent')).toBeDefined();
    expect(screen.getByText('Events by Status')).toBeDefined();
    expect(screen.getByText('Events Over Time')).toBeDefined();
  });

  it('shows empty state when total is 0', async () => {
    mockOk({ ...overviewData, total: 0 });
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
