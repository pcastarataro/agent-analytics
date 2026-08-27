import { render, screen, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { UserDetailPage } from './UserDetailPage';

// Mock useApi
vi.mock('../hooks/useApi', () => ({
  useApi: vi.fn(),
}));

import { useApi } from '../hooks/useApi';

const mockUseApi = vi.mocked(useApi);

const mockUserDetail = {
  userId: 'user-42',
  totalEvents: 200,
  totalCost: 3.4567,
  totalInputTokens: 80000,
  totalOutputTokens: 25000,
  totalCachedTokens: 12000,
  firstSeenAt: '2024-12-01T08:00:00Z',
  lastSeenAt: '2025-01-02T14:30:00Z',
  agentsUsed: [
    { name: 'agent-alpha', count: 120 },
    { name: 'agent-beta', count: 80 },
  ],
  eventsOverTime: [
    { date: '2025-01-01', count: 50 },
    { date: '2025-01-02', count: 70 },
  ],
  recentEvents: [
    {
      id: 'e1',
      actor: { userId: 'user-42' },
      project: {},
      session: {},
      execution: { traceId: 'trace-1' },
      agent: { name: 'agent-alpha' },
      skill: { name: 'code-review' },
      tool: {},
      model: {},
      metrics: { inputTokens: 600, outputTokens: 250, cost: 0.015 },
      result: { status: 'success' as const },
      timestamp: '2025-01-02T14:00:00Z',
    },
  ],
};

function renderWithRouter(ui: React.ReactElement, route = '/users/user-42') {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <Routes>
        <Route path="/users/:userId" element={ui} />
        <Route path="/users" element={<div>Users List</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('UserDetailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('shows loading state', () => {
    mockUseApi.mockReturnValue({ data: null, loading: true, error: null, refetch: vi.fn() });
    renderWithRouter(<UserDetailPage />);
    expect(screen.getByText('Loading…')).toBeDefined();
  });

  it('shows error state', () => {
    mockUseApi.mockReturnValue({
      data: null,
      loading: false,
      error: new Error('User not found'),
      refetch: vi.fn(),
    });
    renderWithRouter(<UserDetailPage />);
    expect(screen.getByText('User not found')).toBeDefined();
  });

  it('renders user id and back link', () => {
    mockUseApi.mockReturnValue({
      data: mockUserDetail,
      loading: false,
      error: null,
      refetch: vi.fn(),
    });

    renderWithRouter(<UserDetailPage />);
    expect(screen.getByText('user-42')).toBeDefined();
    expect(screen.getByText('← Users')).toBeDefined();
  });

  it('renders stat cards with correct values', () => {
    mockUseApi.mockReturnValue({
      data: mockUserDetail,
      loading: false,
      error: null,
      refetch: vi.fn(),
    });

    renderWithRouter(<UserDetailPage />);
    expect(screen.getByText('$3.4567')).toBeDefined();
    expect(screen.getByText('200')).toBeDefined();
    expect(screen.getByText('80,000')).toBeDefined();
    expect(screen.getByText('25,000')).toBeDefined();
  });

  it('renders agents used table', () => {
    mockUseApi.mockReturnValue({
      data: mockUserDetail,
      loading: false,
      error: null,
      refetch: vi.fn(),
    });

    renderWithRouter(<UserDetailPage />);
    // agent-alpha appears in both agents table and recent events table
    expect(screen.getAllByText('agent-alpha').length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText('agent-beta')).toBeDefined();
    expect(screen.getByText('120')).toBeDefined();
    expect(screen.getByText('80')).toBeDefined();
  });

  it('renders recent events table', () => {
    mockUseApi.mockReturnValue({
      data: mockUserDetail,
      loading: false,
      error: null,
      refetch: vi.fn(),
    });

    renderWithRouter(<UserDetailPage />);
    expect(screen.getByText('Recent Events')).toBeDefined();
    expect(screen.getByText('success')).toBeDefined();
  });
});
