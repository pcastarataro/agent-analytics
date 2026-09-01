import { render, screen, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { BranchesPage } from './BranchesPage';

vi.mock('../hooks/useApi', () => ({
  useApi: vi.fn(),
}));

import { useApi } from '../hooks/useApi';

const mockUseApi = vi.mocked(useApi);

const mockBranchStats = [
  {
    branch: 'main',
    eventCount: 80,
    successRate: 90,
    avgDurationMs: 400,
    avgCost: 0.08,
    totalCost: 6.4,
    distinctProjects: 2,
    distinctAgents: 3,
    firstSeenAt: '2026-01-01T00:00:00Z',
    lastSeenAt: '2026-01-15T00:00:00Z',
  },
  {
    branch: 'feature-x',
    eventCount: 20,
    successRate: 80,
    avgDurationMs: 600,
    avgCost: 0.12,
    totalCost: 2.4,
    distinctProjects: 1,
    distinctAgents: 1,
    firstSeenAt: '2026-01-05T00:00:00Z',
    lastSeenAt: '2026-01-10T00:00:00Z',
  },
];

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/branches']}>
      <BranchesPage />
    </MemoryRouter>,
  );
}

describe('BranchesPage', () => {
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

  it('renders branches table with data', () => {
    mockUseApi.mockReturnValue({
      data: { data: mockBranchStats },
      loading: false,
      error: null,
      refetch: vi.fn(),
    });
    renderPage();
    expect(screen.getByText('Branches')).toBeDefined();
    expect(screen.getByText('main')).toBeDefined();
    expect(screen.getByText('feature-x')).toBeDefined();
  });

  it('renders empty state', () => {
    mockUseApi.mockReturnValue({
      data: { data: [] },
      loading: false,
      error: null,
      refetch: vi.fn(),
    });
    renderPage();
    expect(screen.getByText('No branches found.')).toBeDefined();
  });
});
