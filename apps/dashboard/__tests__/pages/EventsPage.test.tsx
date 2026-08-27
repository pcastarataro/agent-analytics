import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventsPage } from '../../src/pages/EventsPage';
import type { PaginatedEvents } from '../../src/api/types';

vi.stubGlobal('fetch', vi.fn());
const mockFetch = vi.mocked(globalThis.fetch);

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function makePaginatedResponse(
  data: PaginatedEvents['data'],
  nextCursor: string | null = null,
): PaginatedEvents {
  return { data, nextCursor };
}

function makeEvent(overrides: Record<string, unknown> = {}) {
  return {
    id: '0192e000-1000-7000-8000-000000000001',
    actor: { userId: 'user-1' },
    project: {},
    session: {},
    execution: { traceId: 'trace-1' },
    agent: { name: 'test-agent' },
    skill: { name: 'test-skill' },
    tool: {},
    model: {},
    metrics: { inputTokens: 50, outputTokens: 100 },
    result: { status: 'success' },
    ...overrides,
  };
}

describe('EventsPage', () => {
  it('shows loading spinner initially', () => {
    mockFetch.mockReturnValue(new Promise(() => {}));
    render(<EventsPage />);

    expect(screen.getByText('Loading…')).toBeDefined();
  });

  it('renders events after fetch', async () => {
    const events = [makeEvent({ agent: { name: 'alpha' } })];
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(makePaginatedResponse(events)),
    } as Response);

    render(<EventsPage />);

    await waitFor(() => {
      expect(screen.getByText('alpha')).toBeDefined();
    });
  });

  it('shows Load More when nextCursor is present', async () => {
    const events = [makeEvent()];
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(makePaginatedResponse(events, 'cursor-123')),
    } as Response);

    render(<EventsPage />);

    await waitFor(() => {
      expect(screen.getByText('Load More')).toBeDefined();
    });
  });

  it('hides Load More when nextCursor is null', async () => {
    const events = [makeEvent()];
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(makePaginatedResponse(events, null)),
    } as Response);

    render(<EventsPage />);

    await waitFor(() => {
      expect(screen.queryByText('Load More')).toBeNull();
    });
  });

  it('appends events on Load More click', async () => {
    const event1 = makeEvent({ id: 'evt-1', agent: { name: 'alpha' } });
    const event2 = makeEvent({ id: 'evt-2', agent: { name: 'beta' } });

    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(makePaginatedResponse([event1], 'cursor-abc')),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(makePaginatedResponse([event2], null)),
      } as Response);

    render(<EventsPage />);

    await waitFor(() => {
      expect(screen.getByText('alpha')).toBeDefined();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Load More' }));

    await waitFor(() => {
      expect(screen.getByText('beta')).toBeDefined();
    });

    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('sends filter params in API call', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(makePaginatedResponse([])),
    } as Response);

    render(<EventsPage />);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalled();
    });

    const calledUrl = mockFetch.mock.calls[0]![0] as string;
    expect(calledUrl).toContain('limit=50');
  });

  it('renders error state on fetch failure', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
    } as Response);

    render(<EventsPage />);

    await waitFor(() => {
      expect(screen.getByText('API 500: Internal Server Error')).toBeDefined();
    });
  });
});
