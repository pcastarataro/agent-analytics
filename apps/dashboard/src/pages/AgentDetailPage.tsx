import { useParams, Link } from 'react-router-dom';
import { useApi } from '../hooks/useApi';
import type { PaginatedEvents, UsageEventDTO } from '../api/types';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { ErrorMessage } from '../components/ErrorMessage';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

function buildTokensPerSkill(events: UsageEventDTO[]): { name: string; tokens: number }[] {
  const map = new Map<string, number>();
  for (const e of events) {
    const name = e.skill?.name ?? 'unknown';
    const tokens = (e.metrics?.inputTokens ?? 0) + (e.metrics?.outputTokens ?? 0);
    map.set(name, (map.get(name) ?? 0) + tokens);
  }
  return Array.from(map.entries())
    .map(([name, tokens]) => ({ name, tokens }))
    .sort((a, b) => b.tokens - a.tokens);
}

function buildEventsOverTime(events: UsageEventDTO[]): { date: string; count: number }[] {
  const map = new Map<string, number>();
  for (const e of events) {
    const ts = e.timestamp;
    if (!ts) continue;
    const date = ts.slice(0, 10);
    map.set(date, (map.get(date) ?? 0) + 1);
  }
  return Array.from(map.entries())
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

export function AgentDetailPage() {
  const { name } = useParams<{ name: string }>();
  const { data, loading, error, refetch } = useApi<PaginatedEvents>(
    `/v1/events?agentName=${encodeURIComponent(name ?? '')}`,
  );

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorMessage message={error.message} onRetry={refetch} />;
  if (!data) return null;

  const events = data.data;
  const tokensPerSkill = buildTokensPerSkill(events);
  const eventsOverTime = buildEventsOverTime(events);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link to="/events" className="text-sm text-blue-600 hover:underline">
          ← Events
        </Link>
        <h2 className="text-xl font-bold text-gray-900">{name}</h2>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <p className="text-sm font-medium text-gray-500">Total Events</p>
          <p className="mt-1 text-3xl font-bold text-gray-900">{events.length.toLocaleString()}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <h3 className="mb-3 text-sm font-medium text-gray-700">Tokens by Skill</h3>
          {tokensPerSkill.length === 0 ? (
            <p className="text-sm text-gray-500">No skill data available.</p>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={tokensPerSkill}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="tokens" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <h3 className="mb-3 text-sm font-medium text-gray-700">Events Over Time</h3>
          {eventsOverTime.length === 0 ? (
            <p className="text-sm text-gray-500">No time-series data available.</p>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={eventsOverTime}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Line type="monotone" dataKey="count" stroke="#3b82f6" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );
}
