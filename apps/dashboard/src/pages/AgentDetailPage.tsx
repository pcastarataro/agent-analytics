import { useParams, Link } from 'react-router-dom';
import { useApi } from '../hooks/useApi';
import type { AgentDetail, Definition } from '../api/types';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { ErrorMessage } from '../components/ErrorMessage';
import { MarkdownViewer } from '../components/MarkdownViewer';
import { useState, useEffect } from 'react';
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

export function AgentDetailPage() {
  const { name } = useParams<{ name: string }>();
  const { data, loading, error, refetch } = useApi<AgentDetail>(
    `/v1/stats/agents/${encodeURIComponent(name ?? '')}`,
  );

  const [definition, setDefinition] = useState<Definition | null>(null);

  useEffect(() => {
    if (!name) return;
    // Fetch all definitions for this agent and pick the latest one
    fetch(`/v1/definitions?entityType=agent&entityName=${encodeURIComponent(name)}`)
      .then((res) => {
        if (!res.ok) return { data: [] };
        return res.json();
      })
      .then((json) => {
        const defs = json.data ?? [];
        setDefinition(defs.length > 0 ? defs[defs.length - 1] : null);
      })
      .catch(() => setDefinition(null));
  }, [name]);

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorMessage message={error.message} onRetry={refetch} />;
  if (!data) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link to="/agents" className="text-sm text-blue-600 hover:underline">
          ← Agents
        </Link>
        <h2 className="text-xl font-bold text-gray-900">{data.agentName}</h2>
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
          <p className="text-sm font-medium text-gray-500">Tokens</p>
          <p className="mt-1 text-2xl font-bold text-gray-900">
            {data.totalInputTokens.toLocaleString()} in
          </p>
          <p className="text-xs text-gray-400">
            {data.totalOutputTokens.toLocaleString()} out · {data.totalCachedTokens.toLocaleString()} cached
          </p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <p className="text-sm font-medium text-gray-500">Distinct Versions</p>
          <p className="mt-1 text-2xl font-bold text-gray-900">
            {data.distinctVersions}
          </p>
        </div>
      </div>

      {data.byVersion.length > 0 && (
        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <h3 className="mb-3 text-sm font-medium text-gray-700">Version Breakdown</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-left text-xs font-medium uppercase text-gray-500">
                  <th className="px-3 py-2">Version</th>
                  <th className="px-3 py-2">Executions</th>
                  <th className="px-3 py-2">Success Rate</th>
                  <th className="px-3 py-2">Total Cost</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {data.byVersion.map((v) => (
                  <tr key={v.version} className="hover:bg-gray-50">
                    <td className="whitespace-nowrap px-3 py-2 font-medium text-gray-900">
                      {v.version}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-gray-600">
                      {v.executionCount.toLocaleString()}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-gray-600">
                      {v.successRate.toFixed(1)}%
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-gray-600">
                      ${v.totalCost.toFixed(4)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <h3 className="mb-3 text-sm font-medium text-gray-700">Tokens by Skill</h3>
          {data.tokensBySkill.length === 0 ? (
            <p className="text-sm text-gray-500">No skill data available.</p>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={data.tokensBySkill}>
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
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <h3 className="mb-3 text-sm font-medium text-gray-700">Definition</h3>
        {definition ? (
          <MarkdownViewer content={definition.content} />
        ) : (
          <p className="text-sm text-gray-500">No definition uploaded.</p>
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
                  <th className="px-3 py-2">Skill</th>
                  <th className="px-3 py-2">Version</th>
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
                      {e.skill?.name ?? '—'}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-gray-600">
                      {e.skill?.version ?? '—'}
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
