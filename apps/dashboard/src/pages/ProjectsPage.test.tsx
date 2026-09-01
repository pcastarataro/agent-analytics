import { render, screen, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { ProjectsPage } from './ProjectsPage';

vi.mock('../hooks/useApi', () => ({
  useApi: vi.fn(),
}));

import { useApi } from '../hooks/useApi';

const mockUseApi = vi.mocked(useApi);

const mockProjectStats = [
  {
    projectName: 'agent-analytics',
    eventCount: 100,
    successRate: 85,
    avgDurationMs: 500,
    avgCost: 0.1,
    totalCost: 10,
    distinctBranches: 3,
    distinctAgents: 2,
    firstSeenAt: '2026-01-01T00:00:00Z',
    lastSeenAt: '2026-01-15T00:00:00Z',
  },
  {
    projectName: 'other-project',
    eventCount: 50,
    successRate: 90,
    avgDurationMs: 300,
    avgCost: 0.05,
    totalCost: 2.5,
    distinctBranches: 1,
    distinctAgents: 1,
    firstSeenAt: '2026-01-05T00:00:00Z',
    lastSeenAt: '2026-01-10T00:00:00Z',
  },
];

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/projects']}>
      <ProjectsPage />
    </MemoryRouter>,
  );
}

describe('ProjectsPage', () => {
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
      error: new Error('API 500'),
      refetch: vi.fn(),
    });
    renderPage();
    expect(screen.getByText('API 500')).toBeDefined();
  });

  it('renders projects table with data', () => {
    mockUseApi.mockReturnValue({
      data: { data: mockProjectStats },
      loading: false,
      error: null,
      refetch: vi.fn(),
    });
    renderPage();
    expect(screen.getByText('Projects')).toBeDefined();
    expect(screen.getByText('agent-analytics')).toBeDefined();
    expect(screen.getByText('other-project')).toBeDefined();
  });

  it('renders empty state', () => {
    mockUseApi.mockReturnValue({
      data: { data: [] },
      loading: false,
      error: null,
      refetch: vi.fn(),
    });
    renderPage();
    expect(screen.getByText('No projects found.')).toBeDefined();
  });
});
