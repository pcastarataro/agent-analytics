import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import type { SessionSummary } from '../../api/types';
import { fetchSessions } from '../../api/client';
import { LoadingSpinner } from '../../components/LoadingSpinner';
import { ErrorMessage } from '../../components/ErrorMessage';

const PAGE_LIMIT = 20;

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const seconds = ms / 1000;
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  const minutes = Math.floor(seconds / 60);
  const remaining = Math.floor(seconds % 60);
  return `${minutes}m ${remaining}s`;
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

export function SessionsListPage() {
  const navigate = useNavigate();
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [agentFilter, setAgentFilter] = useState('');

  const loadSessions = useCallback(async (cursor?: string, append = false) => {
    try {
      if (append) setLoadingMore(true);
      else setLoading(true);
      setError(null);

      const result = await fetchSessions(
        PAGE_LIMIT,
        cursor,
        agentFilter || undefined,
      );

      if (append) {
        setSessions((prev) => [...prev, ...result.data]);
      } else {
        setSessions(result.data);
      }
      setNextCursor(result.nextCursor);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [agentFilter]);

  useEffect(() => {
    void loadSessions();
  }, [loadSessions]);

  const handleLoadMore = useCallback(() => {
    if (nextCursor) {
      void loadSessions(nextCursor, true);
    }
  }, [loadSessions, nextCursor]);

  const handleRowClick = useCallback((traceId: string) => {
    navigate(`/sessions/${encodeURIComponent(traceId)}`);
  }, [navigate]);

  if (loading && sessions.length === 0) return <LoadingSpinner />;
  if (error && sessions.length === 0) {
    return <ErrorMessage message={error.message} onRetry={() => void loadSessions()} />;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-gray-900">Sessions</h2>
        <input
          type="text"
          placeholder="Filter by agent…"
          value={agentFilter}
          onChange={(e) => {
            setAgentFilter(e.target.value);
            setSessions([]);
            setNextCursor(null);
          }}
          className="rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>

      {sessions.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-white p-8 text-center text-gray-500">
          No sessions found
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Session ID
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Agent
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Events
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Started At
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Duration
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Event Types
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {sessions.map((session) => (
                <tr
                  key={session.sessionId}
                  onClick={() => handleRowClick(session.sessionId)}
                  className="cursor-pointer transition-colors hover:bg-gray-50"
                >
                  <td className="whitespace-nowrap px-4 py-3 font-mono text-sm text-gray-900">
                    {session.sessionId.length > 12
                      ? `${session.sessionId.slice(0, 8)}…`
                      : session.sessionId}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-700">
                    {session.agentName}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-700">
                    {session.eventCount}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-500">
                    {formatDate(session.startedAt)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-500">
                    {formatDuration(session.totalDurationMs)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-500">
                    {session.eventTypes.join(', ')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {nextCursor && (
        <div className="flex justify-center">
          <button
            onClick={handleLoadMore}
            disabled={loadingMore}
            className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            {loadingMore ? 'Loading…' : 'Load More'}
          </button>
        </div>
      )}

      {error && sessions.length > 0 && (
        <ErrorMessage message={error.message} onRetry={() => void loadSessions()} />
      )}
    </div>
  );
}
