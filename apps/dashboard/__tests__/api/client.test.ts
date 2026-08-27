import { describe, it, expect, vi, afterEach } from 'vitest';
import { fetchApi } from '../../src/api/client';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('fetchApi', () => {
  it('returns typed response on 200', async () => {
    const payload = { total: 42, byAgent: {}, byStatus: {}, byDate: {} };
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(payload),
      } as Response),
    );

    const result = await fetchApi<typeof payload>('/v1/stats/overview');
    expect(result).toEqual(payload);
  });

  it('rejects with status on non-2xx', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      } as Response),
    );

    await expect(fetchApi<unknown>('/v1/events')).rejects.toThrow('API 500: Internal Server Error');
  });
});
