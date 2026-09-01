import { render, screen, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { BranchDetailPage } from './BranchDetailPage';

vi.mock('../hooks/useApi', () => ({
  useApi: vi.fn(),
}));

import { useApi } from '../hooks/useApi';

const mockUseApi = vi.mocked(useApi);

const mockBranchDetail = {
  branch: 'main',
  totalEvents: 80,
  successRate: 90,
  avgDurationMs: 400,
  totalCost: 6.4,
  avgCost: 0.08,
  totalInputTokens: 4000,
  totalOutputTokens: 2000,
  totalCachedTokens: 400,
  distinctProjects: 2,
  distinctAgents: 3,
  byProject: [{ name: 'agent-analytics', eventCount: 50, totalCost: 4 }],
  byAgent: [{ name: 'test-agent', eventCount: 40, totalCost: 3.2 }],
  eventsOverTime: [{ date: '2026-01-15', count: 80 }],
  costByDate: [{ date: '2026-01-15', cost: 6.4 }],
  recentEvents: [],
};

function renderPage(name = 'main') {
  return render(
    <MemoryRouter initialEntries={[`/branches/${encodeURIComponent(name)}`]}>
      <Routes>
        <Route path="/branches/:name" element={<BranchDetailPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('BranchDetailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('shows loading state', () => {
    mockUseApi.mockReturnValue({ data: null, loading: true, error: null, refetch: vi.fn() });
    renderPage();
    expect(screen.getByText('Loading…')).toBeDefined();
  });

  it('shows error state', () => {
    mockUseApi.mockReturnValue({
      data: null,
      loading: false,
      error: new Error('API 404'),
      refetch: vi.fn(),
    });
    renderPage();
    expect(screen.getByText('API 404')).toBeDefined();
  });

  it('renders branch detail with stats', () => {
    mockUseApi.mockReturnValue({
      data: mockBranchDetail,
      loading: false,
      error: null,
      refetch: vi.fn(),
    });
    renderPage();
    expect(screen.getByText('main')).toBeDefined();
  });

  it('renders back link', () => {
    mockUseApi.mockReturnValue({
      data: mockBranchDetail,
      loading: false,
      error: null,
      refetch: vi.fn(),
    });
    renderPage();
    expect(screen.getByText('← Branches')).toBeDefined();
  });

  it('renders cost by date section', () => {
    mockUseApi.mockReturnValue({
      data: mockBranchDetail,
      loading: false,
      error: null,
      refetch: vi.fn(),
    });
    renderPage();
    expect(screen.getByText('Cost by Date')).toBeDefined();
  });
});
