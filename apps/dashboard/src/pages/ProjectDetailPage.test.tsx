import { render, screen, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ProjectDetailPage } from './ProjectDetailPage';

vi.mock('../hooks/useApi', () => ({
  useApi: vi.fn(),
}));

import { useApi } from '../hooks/useApi';

const mockUseApi = vi.mocked(useApi);

const mockProjectDetail = {
  projectName: 'agent-analytics',
  totalEvents: 100,
  successRate: 85,
  avgDurationMs: 500,
  totalCost: 10,
  avgCost: 0.1,
  totalInputTokens: 5000,
  totalOutputTokens: 2500,
  totalCachedTokens: 500,
  distinctBranches: 3,
  distinctAgents: 2,
  byBranch: [{ branch: 'main', eventCount: 70, totalCost: 7 }],
  byAgent: [{ name: 'test-agent', eventCount: 50, totalCost: 5 }],
  eventsOverTime: [{ date: '2026-01-15', count: 100 }],
  recentEvents: [],
};

function renderPage(name = 'agent-analytics') {
  return render(
    <MemoryRouter initialEntries={[`/projects/${encodeURIComponent(name)}`]}>
      <Routes>
        <Route path="/projects/:name" element={<ProjectDetailPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('ProjectDetailPage', () => {
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

  it('renders project detail with stats', () => {
    mockUseApi.mockReturnValue({
      data: mockProjectDetail,
      loading: false,
      error: null,
      refetch: vi.fn(),
    });
    renderPage();
    expect(screen.getByText('agent-analytics')).toBeDefined();
  });

  it('renders back link', () => {
    mockUseApi.mockReturnValue({
      data: mockProjectDetail,
      loading: false,
      error: null,
      refetch: vi.fn(),
    });
    renderPage();
    expect(screen.getByText('← Projects')).toBeDefined();
  });
});
