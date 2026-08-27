import { render, screen, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { SkillDetailPage } from './SkillDetailPage';

// Mock useApi
vi.mock('../hooks/useApi', () => ({
  useApi: vi.fn(),
}));

import { useApi } from '../hooks/useApi';

const mockUseApi = vi.mocked(useApi);

const mockSkillDetail = {
  skillName: 'code-review',
  totalEvents: 85,
  successRate: 92.3,
  avgCost: 0.0089,
  totalCost: 0.7565,
  eventsOverTime: [
    { date: '2025-01-01', count: 20 },
    { date: '2025-01-02', count: 35 },
  ],
  costByDate: [
    { date: '2025-01-01', cost: 0.2 },
    { date: '2025-01-02', cost: 0.35 },
  ],
  recentEvents: [
    {
      id: 'e1',
      actor: { userId: 'u1' },
      project: {},
      session: {},
      execution: { traceId: 'trace-1' },
      agent: { name: 'my-agent' },
      skill: { name: 'code-review' },
      tool: {},
      model: {},
      metrics: { inputTokens: 400, outputTokens: 150, cost: 0.009 },
      result: { status: 'success' as const },
      timestamp: '2025-01-02T10:00:00Z',
    },
  ],
};

function renderWithRouter(ui: React.ReactElement, route = '/skills/code-review') {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <Routes>
        <Route path="/skills/:skillName" element={ui} />
        <Route path="/skills" element={<div>Skills List</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('SkillDetailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('shows loading state', () => {
    mockUseApi.mockReturnValue({ data: null, loading: true, error: null, refetch: vi.fn() });
    renderWithRouter(<SkillDetailPage />);
    expect(screen.getByText('Loading…')).toBeDefined();
  });

  it('shows error state', () => {
    mockUseApi.mockReturnValue({
      data: null,
      loading: false,
      error: new Error('Skill not found'),
      refetch: vi.fn(),
    });
    renderWithRouter(<SkillDetailPage />);
    expect(screen.getByText('Skill not found')).toBeDefined();
  });

  it('renders skill name and back link', () => {
    mockUseApi.mockReturnValue({
      data: mockSkillDetail,
      loading: false,
      error: null,
      refetch: vi.fn(),
    });

    renderWithRouter(<SkillDetailPage />);
    expect(screen.getByText('code-review')).toBeDefined();
    expect(screen.getByText('← Skills')).toBeDefined();
  });

  it('renders stat cards with correct values', () => {
    mockUseApi.mockReturnValue({
      data: mockSkillDetail,
      loading: false,
      error: null,
      refetch: vi.fn(),
    });

    renderWithRouter(<SkillDetailPage />);
    expect(screen.getByText('$0.7565')).toBeDefined();
    expect(screen.getByText('$0.0089')).toBeDefined();
    expect(screen.getByText('92.3%')).toBeDefined();
    expect(screen.getByText('85')).toBeDefined();
  });

  it('renders recent events table', () => {
    mockUseApi.mockReturnValue({
      data: mockSkillDetail,
      loading: false,
      error: null,
      refetch: vi.fn(),
    });

    renderWithRouter(<SkillDetailPage />);
    expect(screen.getByText('Recent Events')).toBeDefined();
    expect(screen.getByText('my-agent')).toBeDefined();
    expect(screen.getByText('success')).toBeDefined();
  });
});
