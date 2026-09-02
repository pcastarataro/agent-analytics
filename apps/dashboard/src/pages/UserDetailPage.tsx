import { Link, useParams } from 'react-router-dom';
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
        <h2 className="text-xl font-bold text-gray-900">{data.userName ?? data.userId}</h2>
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
          <p className="text-sm font-medium text-gray-500">Cached Tokens</p>
          <p className="mt-1 text-2xl font-bold text-gray-900">
            {data.totalCachedTokens.toLocaleString()}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {data.agentsUsed.length > 0 && (
          <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
            <h3 className="mb-3 text-sm font-medium text-gray-700">Agents Used</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-left text-xs font-medium uppercase text-gray-500">
                    <th className="px-3 py-2">Agent</th>
                    <th className="px-3 py-2">Events</th>
                    <th className="px-3 py-2">Total Cost</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {data.agentsUsed.map((a: { name: string; count: number; totalCost: number }) => (
                    <tr key={a.name} className="hover:bg-gray-50">
                      <td className="whitespace-nowrap px-3 py-2 font-medium text-gray-900">
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
                      <td className="whitespace-nowrap px-3 py-2 text-gray-600">
                        ${(a.totalCost ?? 0).toFixed(4)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {data.skillsUsed.length > 0 && (
          <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
            <h3 className="mb-3 text-sm font-medium text-gray-700">Skills Used</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-left text-xs font-medium uppercase text-gray-500">
                    <th className="px-3 py-2">Skill</th>
                    <th className="px-3 py-2">Events</th>
                    <th className="px-3 py-2">Total Cost</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {data.skillsUsed.map((s: { name: string; count: number; totalCost: number }) => (
                    <tr key={s.name} className="hover:bg-gray-50">
                      <td className="whitespace-nowrap px-3 py-2 font-medium text-gray-900">
                        <Link
                          to={`/skills/${encodeURIComponent(s.name)}`}
                          className="text-blue-600 hover:underline"
                        >
                          {s.name}
                        </Link>
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-gray-600">
                        {s.count.toLocaleString()}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-gray-600">
                        ${(s.totalCost ?? 0).toFixed(4)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {data.byProject.length > 0 && (
          <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
            <h3 className="mb-3 text-sm font-medium text-gray-700">Projects</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-left text-xs font-medium uppercase text-gray-500">
                    <th className="px-3 py-2">Project</th>
                    <th className="px-3 py-2">Events</th>
                    <th className="px-3 py-2">Total Cost</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {data.byProject.map((p: { name: string; eventCount: number; totalCost: number }) => (
                    <tr key={p.name} className="hover:bg-gray-50">
                      <td className="whitespace-nowrap px-3 py-2 font-medium text-gray-900">
                        <Link
                          to={`/projects/${encodeURIComponent(p.name)}`}
                          className="text-blue-600 hover:underline"
                        >
                          {p.name}
                        </Link>
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-gray-600">
                        {p.eventCount.toLocaleString()}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-gray-600">
                        ${p.totalCost.toFixed(4)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {data.byBranch.length > 0 && (
          <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
            <h3 className="mb-3 text-sm font-medium text-gray-700">Branches</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-left text-xs font-medium uppercase text-gray-500">
                    <th className="px-3 py-2">Branch</th>
                    <th className="px-3 py-2">Events</th>
                    <th className="px-3 py-2">Total Cost</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {data.byBranch.map((b: { name: string; eventCount: number; totalCost: number }) => (
                    <tr key={b.name} className="hover:bg-gray-50">
                      <td className="whitespace-nowrap px-3 py-2 font-medium text-gray-900">
                        <Link
                          to={`/branches/${encodeURIComponent(b.name)}`}
                          className="text-blue-600 hover:underline"
                        >
                          {b.name}
                        </Link>
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-gray-600">
                        {b.eventCount.toLocaleString()}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-gray-600">
                        ${b.totalCost.toFixed(4)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {data.eventsOverTime.length > 0 && (
          <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
            <h3 className="mb-3 text-sm font-medium text-gray-700">Events Over Time</h3>
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={data.eventsOverTime}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Line type="monotone" dataKey="count" stroke="#3b82f6" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {data.costByDate.length > 0 && (
          <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
            <h3 className="mb-3 text-sm font-medium text-gray-700">Cost by Date</h3>
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={data.costByDate}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip formatter={(value: number) => `$${value.toFixed(4)}`} />
                <Line type="monotone" dataKey="cost" stroke="#8b5cf6" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {data.recentEvents.length > 0 && (
        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <h3 className="mb-3 text-sm font-medium text-gray-700">Recent Events</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-left text-xs font-medium uppercase text-gray-500">
                  <th className="px-3 py-2">Timestamp</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Agent</th>
                  <th className="px-3 py-2">Project</th>
                  <th className="px-3 py-2">Cost</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {data.recentEvents.map((e: UserDetail['recentEvents'][number]) => (
                  <tr key={e.id} className="hover:bg-gray-50">
                    <td className="whitespace-nowrap px-3 py-2 text-gray-600">
                      {e.timestamp ? new Date(e.timestamp).toLocaleString() : '—'}
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
                      {e.agent?.name ?? '—'}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-gray-600">
                      {(e.project as Record<string, unknown>)?.name as string ?? '—'}
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
