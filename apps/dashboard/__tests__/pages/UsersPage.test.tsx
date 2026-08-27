import { render, screen, waitFor, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { UsersPage } from '../../src/pages/UsersPage';

vi.stubGlobal('fetch', vi.fn());
const mockFetch = vi.mocked(globalThis.fetch);

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function mockOk(data: unknown) {
  mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve(data) } as Response);
}

describe('UsersPage', () => {
  it('shows loading spinner initially', () => {
    mockFetch.mockReturnValue(new Promise(() => {}));
    render(<UsersPage />);
    expect(screen.getByText('Loading…')).toBeDefined();
  });

  it('renders user rows from API data', async () => {
    mockOk({
      data: [
        { userId: 'user-1', eventCount: 10, distinctAgents: 3, distinctSkills: 5, firstSeenAt: '2025-01-10T08:00:00Z', lastSeenAt: '2025-01-15T12:00:00Z' },
      ],
    });
    render(<UsersPage />);

    await waitFor(() => {
      expect(screen.getByText('user-1')).toBeDefined();
    });

    expect(screen.getByText('10')).toBeDefined();
    expect(screen.getByText('3')).toBeDefined();
    expect(screen.getByText('5')).toBeDefined();
  });

  it('shows empty state when no users', async () => {
    mockOk({ data: [] });
    render(<UsersPage />);

    await waitFor(() => {
      expect(screen.getByText('No users found.')).toBeDefined();
    });
  });

  it('shows error with retry on API failure', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 500, statusText: 'Internal Server Error' } as Response);
    render(<UsersPage />);

    await waitFor(() => {
      expect(screen.getByText('API 500: Internal Server Error')).toBeDefined();
    });

    expect(screen.getByRole('button', { name: 'Retry' })).toBeDefined();
  });
});
