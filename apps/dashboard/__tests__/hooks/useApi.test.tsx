import { renderHook, waitFor, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { useApi } from '../../src/hooks/useApi';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('useApi', () => {
  it('returns data on success', async () => {
    const payload = { total: 10 };
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(payload),
      } as Response),
    );

    const { result } = renderHook(() => useApi<typeof payload>('/v1/stats/overview'));

    expect(result.current.loading).toBe(true);

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.data).toEqual(payload);
    expect(result.current.error).toBeNull();
  });

  it('returns error on failure', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      } as Response),
    );

    const { result } = renderHook(() => useApi<unknown>('/v1/events'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.data).toBeNull();
    expect(result.current.error?.message).toBe('API 500: Internal Server Error');
  });
});
