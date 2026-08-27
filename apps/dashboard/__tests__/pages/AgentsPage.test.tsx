import { render, screen, waitFor, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { AgentsPage } from '../../src/pages/AgentsPage';

vi.stubGlobal('fetch', vi.fn());
const mockFetch = vi.mocked(globalThis.fetch);

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const agentData = {
  data: [
    { agentName: 'alpha', version: '1.0.0', executionCount: 50, successRate: 92.5, avgDurationMs: 320, totalCost: 1.23 },
    { agentName: 'beta', version: '2.0.0', executionCount: 30, successRate: 88.0, avgDurationMs: 410, totalCost: 0.87 },
  ],
};

function mockOk(data: unknown) {
  mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve(data) } as Response);
}

function mockError(status: number, statusText: string) {
  mockFetch.mockResolvedValue({ ok: false, status, statusText } as Response);
}

describe('AgentsPage', () => {
  it('shows loading spinner initially', () => {
    mockFetch.mockReturnValue(new Promise(() => {}));
    render(<AgentsPage />);
    expect(screen.getByText('Loading…')).toBeDefined();
  });

  it('renders agent rows from API data', async () => {
    mockOk(agentData);
    render(<AgentsPage />);

    await waitFor(() => {
      expect(screen.getByText('alpha')).toBeDefined();
    });

    expect(screen.getByText('beta')).toBeDefined();
    expect(screen.getByText('1.0.0')).toBeDefined();
    expect(screen.getByText('2.0.0')).toBeDefined();
    expect(screen.getByText('92.5%')).toBeDefined();
    expect(screen.getByText('88.0%')).toBeDefined();
  });

  it('shows empty state when no agents', async () => {
    mockOk({ data: [] });
    render(<AgentsPage />);

    await waitFor(() => {
      expect(screen.getByText('No agents found.')).toBeDefined();
    });
  });

  it('shows error with retry on API failure', async () => {
    mockError(500, 'Internal Server Error');
    render(<AgentsPage />);

    await waitFor(() => {
      expect(screen.getByText('API 500: Internal Server Error')).toBeDefined();
    });

    expect(screen.getByRole('button', { name: 'Retry' })).toBeDefined();
  });
});
