import { useParams, Link } from 'react-router-dom';
import { useApi } from '../hooks/useApi';
import type { UserDetail } from '../api/types';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { ErrorMessage } from '../components/ErrorMessage';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

export function UserDetailPage() {
  const { userId } = useParams<{ userId: string }>();
  const { data, loading, error, refetch } = useApi<UserDetail>(
    `/v1/stats/users/${encodeURIComponent(userId ?? '')}`,
  );

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorMessage message={error.message} onRetry={refetch} />;
  if (!data) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link to="/users" className="text-sm text-blue-600 hover:underline">
          ← Users
        </Link>
        <h2 className="text-xl font-bold text-gray-900">{data.userId}</h2>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <p className="text-sm font-medium text-gray-500">Total Cost</p>
          <p className="mt-1 text-2xl font-bold text-gray-900">
            ${data.totalCost.toFixed(4)}
          </p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <p className="text-sm font-medium text-gray-500">Total Events</p>
          <p className="mt-1 text-2xl font-bold text-gray-900">
            {data.totalEvents.toLocaleString()}
          </p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <p className="text-sm font-medium text-gray-500">Input Tokens</p>
          <p className="mt-1 text-2xl font-bold text-gray-900">
            {data.totalInputTokens.toLocaleString()}
          </p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <p className="text-sm font-medium text-gray-500">Output Tokens</p>
          <p className="mt-1 text-2xl font-bold text-gray-900">
            {data.totalOutputTokens.toLocaleString()}
          </p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <p className="text-sm font-medium text-gray-500">First / Last Seen</p>
          <p className="mt-1 text-sm font-bold text-gray-900">
            {new Date(data.firstSeenAt).toLocaleDateString()}
          </p>
          <p className="text-xs text-gray-400">
            {new Date(data.lastSeenAt).toLocaleDateString()}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <h3 className="mb-3 text-sm font-medium text-gray-700">Events Over Time</h3>
          {data.eventsOverTime.length === 0 ? (
            <p className="text-sm text-gray-500">No time-series data available.</p>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={data.eventsOverTime}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Line type="monotone" dataKey="count" stroke="#3b82f6" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <h3 className="mb-3 text-sm font-medium text-gray-700">Agents Used</h3>
          {data.agentsUsed.length === 0 ? (
            <p className="text-sm text-gray-500">No agent data available.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-left text-xs font-medium uppercase text-gray-500">
                    <th className="px-3 py-2">Agent</th>
                    <th className="px-3 py-2">Events</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {data.agentsUsed.map((a) => (
                    <tr key={a.name} className="hover:bg-gray-50">
                      <td className="whitespace-nowrap px-3 py-2 text-gray-700">
                        <Link
                          to={`/agents/${encodeURIComponent(a.name)}`}
                          className="text-blue-600 hover:underline"
                        >
                          {a.name}
                        </Link>
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-gray-600">
                        {a.count.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {data.recentEvents.length > 0 && (
        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <h3 className="mb-3 text-sm font-medium text-gray-700">Recent Events</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-left text-xs font-medium uppercase text-gray-500">
                  <th className="px-3 py-2">Timestamp</th>
                  <th className="px-3 py-2">Agent</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Tokens</th>
                  <th className="px-3 py-2">Cost</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {data.recentEvents.map((e) => (
                  <tr key={e.id} className="hover:bg-gray-50">
                    <td className="whitespace-nowrap px-3 py-2 text-gray-600">
                      {e.timestamp ? new Date(e.timestamp).toLocaleString() : '—'}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-gray-600">
                      {e.agent?.name ?? '—'}
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                          e.result.status === 'success'
                            ? 'bg-green-100 text-green-700'
                            : e.result.status === 'error'
                              ? 'bg-red-100 text-red-700'
                              : 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {e.result.status}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-gray-600">
                      {((e.metrics?.inputTokens ?? 0) + (e.metrics?.outputTokens ?? 0)).toLocaleString()}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-gray-600">
                      ${(e.metrics?.cost ?? 0).toFixed(4)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
