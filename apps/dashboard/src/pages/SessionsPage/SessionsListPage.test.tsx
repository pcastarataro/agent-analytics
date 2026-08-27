import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import { SessionsListPage } from './SessionsListPage';

// Mock fetchSessions
vi.mock('../../api/client', () => ({
  fetchSessions: vi.fn(),
}));

import { fetchSessions } from '../../api/client';

const mockFetchSessions = vi.mocked(fetchSessions);

function renderWithRouter(ui: React.ReactElement) {
  return render(<BrowserRouter>{ui}</BrowserRouter>);
}

describe('SessionsListPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows loading state initially', () => {
    mockFetchSessions.mockReturnValue(new Promise(() => {})); // never resolves
    renderWithRouter(<SessionsListPage />);
    expect(screen.getByText('Loading…')).toBeDefined();
  });

  it('renders sessions table', async () => {
    mockFetchSessions.mockResolvedValue({
      data: [
        {
          sessionId: 'sess-abc123',
          eventCount: 5,
          startedAt: '2025-01-01T12:00:00Z',
          lastEventAt: '2025-01-01T12:00:10Z',
          totalDurationMs: 10000,
          agentName: 'test-agent',
          eventTypes: ['tool_call', 'assistant_message'],
        },
      ],
      nextCursor: null,
    });

    renderWithRouter(<SessionsListPage />);

    expect(await screen.findByText('Sessions')).toBeDefined();
    expect(screen.getByText(/sess-abc123/)).toBeDefined();
    expect(screen.getByText('test-agent')).toBeDefined();
    expect(screen.getByText('5')).toBeDefined();
  });

  it('renders empty state when no sessions', async () => {
    mockFetchSessions.mockResolvedValue({ data: [], nextCursor: null });
    renderWithRouter(<SessionsListPage />);
    expect(await screen.findByText('No sessions found')).toBeDefined();
  });

  it('shows error state', async () => {
    mockFetchSessions.mockRejectedValue(new Error('Network error'));
    renderWithRouter(<SessionsListPage />);
    expect(await screen.findByText('Network error')).toBeDefined();
  });
});
