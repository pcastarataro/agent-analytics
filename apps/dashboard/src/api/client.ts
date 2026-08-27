export async function fetchApi<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, init);
  if (!res.ok) {
    throw new Error(`API ${res.status}: ${res.statusText}`);
  }
  return (await res.json()) as T;
}

export async function fetchSessions(
  limit?: number,
  cursor?: string,
  agentName?: string,
) {
  const params = new URLSearchParams();
  if (limit) params.set('limit', String(limit));
  if (cursor) params.set('cursor', cursor);
  if (agentName) params.set('agentName', agentName);
  const qs = params.toString();
  return fetchApi<{ data: import('./types').SessionSummary[]; nextCursor: string | null }>(
    `/v1/sessions${qs ? `?${qs}` : ''}`,
  );
}

export async function fetchSessionDetail(traceId: string) {
  const res = await fetchApi<{ data: import('./types').SessionDetail }>(
    `/v1/sessions/${encodeURIComponent(traceId)}`,
  );
  return res.data;
}

export async function fetchSessionEvents(traceId: string) {
  const detail = await fetchSessionDetail(traceId);
  return detail.events;
}
