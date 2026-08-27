import { useApi } from '../hooks/useApi';
import type { AgentStat } from '../api/types';
import { SortableTable, Column } from '../components/SortableTable';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { ErrorMessage } from '../components/ErrorMessage';

interface AgentStatRow extends Record<string, unknown> {
  agentName: string;
  version: string;
  executionCount: number;
  successRate: number;
  avgDurationMs: number;
  totalCost: number;
}

const columns: Column<AgentStatRow>[] = [
  { key: 'agentName', label: 'Agent' },
  { key: 'version', label: 'Version' },
  { key: 'executionCount', label: 'Executions', sortable: true },
  {
    key: 'successRate',
    label: 'Success Rate',
    render: (row) => `${row.successRate.toFixed(1)}%`,
  },
  {
    key: 'avgDurationMs',
    label: 'Avg Duration',
    render: (row) => `${row.avgDurationMs.toLocaleString()} ms`,
  },
  {
    key: 'totalCost',
    label: 'Total Cost',
    render: (row) => `$${row.totalCost.toFixed(4)}`,
  },
];

export function AgentsPage() {
  const { data, loading, error, refetch } = useApi<{ data: AgentStat[] }>('/v1/stats/agents');

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorMessage message={error.message} onRetry={refetch} />;

  const rows: AgentStatRow[] = (data?.data ?? []).map((a) => ({ ...a }));

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold text-gray-900">Agents</h2>
      <SortableTable
        columns={columns}
        data={rows}
        defaultSortKey="executionCount"
        defaultSortDir="desc"
        emptyMessage="No agents found."
      />
    </div>
  );
}
