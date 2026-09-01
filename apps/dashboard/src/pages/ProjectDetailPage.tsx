import { useParams, Link } from 'react-router-dom';
import { useApi } from '../hooks/useApi';
import type { ProjectDetail } from '../api/types';
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

export function ProjectDetailPage() {
  const { name } = useParams<{ name: string }>();
  const { data, loading, error, refetch } = useApi<ProjectDetail>(
    `/v1/stats/projects/${encodeURIComponent(name ?? '')}`,
  );

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorMessage message={error.message} onRetry={refetch} />;
  if (!data) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link to="/projects" className="text-sm text-blue-600 hover:underline">
          ← Projects
        </Link>
        <h2 className="text-xl font-bold text-gray-900">{data.projectName}</h2>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-6">
        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <p className="text-sm font-medium text-gray-500">Total Cost</p>
          <p className="mt-1 text-2xl font-bold text-gray-900">
            ${data.totalCost.toFixed(4)}
          </p>
          <p className="text-xs text-gray-400">avg ${data.avgCost.toFixed(4)}</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <p className="text-sm font-medium text-gray-500">Success Rate</p>
          <p className="mt-1 text-2xl font-bold text-gray-900">
            {data.successRate.toFixed(1)}%
          </p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <p className="text-sm font-medium text-gray-500">Avg Duration</p>
          <p className="mt-1 text-2xl font-bold text-gray-900">
            {data.avgDurationMs.toLocaleString()} ms
          </p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <p className="text-sm font-medium text-gray-500">Total Events</p>
          <p className="mt-1 text-2xl font-bold text-gray-900">
            {data.totalEvents.toLocaleString()}
          </p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <p className="text-sm font-medium text-gray-500">Branches</p>
          <p className="mt-1 text-2xl font-bold text-gray-900">
            {data.distinctBranches}
          </p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <p className="text-sm font-medium text-gray-500">Agents</p>
          <p className="mt-1 text-2xl font-bold text-gray-900">
            {data.distinctAgents}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
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
                  {data.byBranch.map((b) => (
                    <tr key={b.branch} className="hover:bg-gray-50">
                      <td className="whitespace-nowrap px-3 py-2 font-medium text-gray-900">
                        <Link
                          to={`/branches/${encodeURIComponent(b.branch)}`}
                          className="text-blue-600 hover:underline"
                        >
                          {b.branch}
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

        {data.byAgent.length > 0 && (
          <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
            <h3 className="mb-3 text-sm font-medium text-gray-700">Agents</h3>
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
                  {data.byAgent.map((a) => (
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
                        {a.eventCount.toLocaleString()}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-gray-600">
                        ${a.totalCost.toFixed(4)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {data.bySkill.length > 0 && (
          <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
            <h3 className="mb-3 text-sm font-medium text-gray-700">Skills</h3>
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
                  {data.bySkill.map((s) => (
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
                        {s.eventCount.toLocaleString()}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-gray-600">
                        ${s.totalCost.toFixed(4)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {data.byUser.length > 0 && (
          <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
            <h3 className="mb-3 text-sm font-medium text-gray-700">Users</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-left text-xs font-medium uppercase text-gray-500">
                    <th className="px-3 py-2">User</th>
                    <th className="px-3 py-2">Events</th>
                    <th className="px-3 py-2">Total Cost</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {data.byUser.map((u) => (
                    <tr key={u.name} className="hover:bg-gray-50">
                      <td className="whitespace-nowrap px-3 py-2 font-medium text-gray-900">
                        <Link
                          to={`/users/${encodeURIComponent(u.name)}`}
                          className="text-blue-600 hover:underline"
                        >
                          {u.name}
                        </Link>
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-gray-600">
                        {u.eventCount.toLocaleString()}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-gray-600">
                        ${u.totalCost.toFixed(4)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

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
                  <th className="px-3 py-2">Branch</th>
                  <th className="px-3 py-2">Cost</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {data.recentEvents.map((e) => (
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
                      {(e.project as Record<string, unknown>)?.branch as string ?? '—'}
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
