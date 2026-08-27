import { render, screen, waitFor, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { SkillsPage } from '../../src/pages/SkillsPage';

vi.stubGlobal('fetch', vi.fn());
const mockFetch = vi.mocked(globalThis.fetch);

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const skillData = {
  data: [
    { skillName: 'code-review', version: '1.2.0', executionCount: 40, successRate: 95.0, avgCost: 0.0238, totalCost: 0.95 },
    { skillName: 'testing', version: '3.0.0', executionCount: 25, successRate: 80.0, avgCost: 0.0240, totalCost: 0.60 },
  ],
};

function mockOk(data: unknown) {
  mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve(data) } as Response);
}

describe('SkillsPage', () => {
  it('shows loading spinner initially', () => {
    mockFetch.mockReturnValue(new Promise(() => {}));
    render(<SkillsPage />);
    expect(screen.getByText('Loading…')).toBeDefined();
  });

  it('renders skill rows from API data', async () => {
    mockOk(skillData);
    render(<SkillsPage />);

    await waitFor(() => {
      expect(screen.getByText('code-review')).toBeDefined();
    });

    expect(screen.getByText('testing')).toBeDefined();
    expect(screen.getByText('1.2.0')).toBeDefined();
    expect(screen.getByText('3.0.0')).toBeDefined();
    expect(screen.getByText('95.0%')).toBeDefined();
    expect(screen.getByText('80.0%')).toBeDefined();
  });

  it('shows empty state when no skills', async () => {
    mockOk({ data: [] });
    render(<SkillsPage />);

    await waitFor(() => {
      expect(screen.getByText('No skills found.')).toBeDefined();
    });
  });
});
