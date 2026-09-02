import { render, screen, waitFor, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { UsersPage } from '../../src/pages/UsersPage';
import { AuthProvider } from '../../src/contexts/AuthContext';

vi.stubGlobal('fetch', vi.fn());
const mockFetch = vi.mocked(globalThis.fetch);

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function mockOk(data: unknown) {
  mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve(data) } as Response);
}

function mockError(status: number, statusText: string) {
  mockFetch.mockResolvedValue({
    ok: false,
    status,
    statusText,
    json: () => Promise.resolve({ error: statusText }),
  } as Response);
}

function renderWithAuth(ui: React.ReactElement) {
  return render(<AuthProvider>{ui}</AuthProvider>);
}

describe('UsersPage', () => {
  it('shows loading spinner initially', () => {
    mockFetch.mockReturnValue(new Promise(() => {}));
    renderWithAuth(<UsersPage />);
    expect(screen.getByText('Loading…')).toBeDefined();
  });

  it('renders user rows from API data', async () => {
    mockOk([
      { id: 'u1', name: 'alice', createdAt: '2025-01-10T08:00:00Z', updatedAt: '2025-01-10T08:00:00Z' },
    ]);
    renderWithAuth(<UsersPage />);

    await waitFor(() => {
      expect(screen.getByText('alice')).toBeDefined();
    });

    expect(screen.getByText('Revoke')).toBeDefined();
    expect(screen.getByText('Regenerate')).toBeDefined();
    expect(screen.getByText('Delete')).toBeDefined();
  });

  it('shows empty state when no users', async () => {
    mockOk([]);
    renderWithAuth(<UsersPage />);

    await waitFor(() => {
      expect(screen.getByText('No users yet.')).toBeDefined();
    });
  });

  it('shows error with retry on API failure', async () => {
    // Auth validation: no token → skipped, then UsersPage fetch fails
    mockError(500, 'Internal Server Error');

    renderWithAuth(<UsersPage />);

    await waitFor(() => {
      expect(screen.getByText(/Internal Server Error/)).toBeDefined();
    });
  });
});
