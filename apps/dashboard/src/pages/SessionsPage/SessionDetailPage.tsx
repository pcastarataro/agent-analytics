import { useParams, Link } from 'react-router-dom';
import { useApi } from '../../hooks/useApi';
import type { SessionDetail } from '../../api/types';
import { LoadingSpinner } from '../../components/LoadingSpinner';
import { ErrorMessage } from '../../components/ErrorMessage';
import { GanttChart } from '../../components/Gantt/GanttChart';

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

export function SessionDetailPage() {
  const { traceId } = useParams<{ traceId: string }>();
  const { data, loading, error, refetch } = useApi<{ data: SessionDetail }>(
    `/v1/sessions/${encodeURIComponent(traceId ?? '')}`,
  );

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorMessage message={error.message} onRetry={refetch} />;
  if (!data) return null;

  const { session, events } = data.data;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link to="/sessions" className="text-sm text-blue-600 hover:underline">
          ← Sessions
        </Link>
        <h2 className="text-xl font-bold text-gray-900">Session {session.sessionId}</h2>
      </div>

      {/* Session summary header */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <p className="text-sm font-medium text-gray-500">Agent</p>
          <p className="mt-1 text-lg font-semibold text-gray-900">{session.agentName}</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <p className="text-sm font-medium text-gray-500">Events</p>
          <p className="mt-1 text-lg font-semibold text-gray-900">{session.eventCount}</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <p className="text-sm font-medium text-gray-500">Duration</p>
          <p className="mt-1 text-lg font-semibold text-gray-900">
            {formatDuration(session.totalDurationMs)}
          </p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <p className="text-sm font-medium text-gray-500">Time Range</p>
          <p className="mt-1 text-sm text-gray-900">
            {formatDate(session.startedAt)} — {formatDate(session.lastEventAt)}
          </p>
        </div>
      </div>

      {/* Gantt chart */}
      <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <h3 className="mb-3 text-sm font-medium text-gray-700">Event Timeline</h3>
        <GanttChart events={events} />
      </div>
    </div>
  );
}
