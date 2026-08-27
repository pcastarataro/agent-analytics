import { render, screen, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { SessionDetailPage } from './SessionDetailPage';

// Mock useApi
vi.mock('../../hooks/useApi', () => ({
  useApi: vi.fn(),
}));

import { useApi } from '../../hooks/useApi';

const mockUseApi = vi.mocked(useApi);

function renderWithRouter(ui: React.ReactElement, route = '/sessions/trace-123') {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <Routes>
        <Route path="/sessions/:traceId" element={ui} />
        <Route path="/sessions" element={<div>Sessions List</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('SessionDetailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('shows loading state', () => {
    mockUseApi.mockReturnValue({ data: null, loading: true, error: null, refetch: vi.fn() });
    renderWithRouter(<SessionDetailPage />);
    expect(screen.getByText('Loading…')).toBeDefined();
  });

  it('shows error state', () => {
    mockUseApi.mockReturnValue({
      data: null,
      loading: false,
      error: new Error('Not found'),
      refetch: vi.fn(),
    });
    renderWithRouter(<SessionDetailPage />);
    expect(screen.getByText('Not found')).toBeDefined();
  });

  it('renders session header and gantt', () => {
    mockUseApi.mockReturnValue({
      data: {
        data: {
          session: {
            sessionId: 'trace-123',
            eventCount: 3,
            startedAt: '2025-01-01T12:00:00Z',
            lastEventAt: '2025-01-01T12:00:05Z',
            totalDurationMs: 5000,
            agentName: 'my-agent',
            eventTypes: ['tool_call'],
          },
          events: [
            {
              id: 'e1',
              actor: { userId: 'u1' },
              project: {},
              session: {},
              execution: { traceId: 'trace-123' },
              agent: { name: 'my-agent' },
              skill: { name: 's1' },
              tool: {},
              model: {},
              metrics: { durationMs: 200 },
              result: { status: 'success' },
              timestamp: '2025-01-01T12:00:01Z',
              eventType: 'tool_call',
            },
          ],
        },
      },
      loading: false,
      error: null,
      refetch: vi.fn(),
    });

    renderWithRouter(<SessionDetailPage />);
    expect(screen.getByText(/Session trace-123/)).toBeDefined();
    expect(screen.getByText('my-agent')).toBeDefined();
    expect(screen.getByText('3')).toBeDefined();
    expect(screen.getByText('5.0s')).toBeDefined();
    expect(screen.getByText('Event Timeline')).toBeDefined();
  });

  it('has back link to sessions list', () => {
    mockUseApi.mockReturnValue({
      data: {
        data: {
          session: {
            sessionId: 'trace-123',
            eventCount: 0,
            startedAt: '2025-01-01T12:00:00Z',
            lastEventAt: '2025-01-01T12:00:00Z',
            totalDurationMs: 0,
            agentName: 'agent',
            eventTypes: [],
          },
          events: [],
        },
      },
      loading: false,
      error: null,
      refetch: vi.fn(),
    });

    renderWithRouter(<SessionDetailPage />);
    const links = screen.getAllByText('← Sessions');
    expect(links.length).toBeGreaterThanOrEqual(1);
  });
});
