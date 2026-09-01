import { useApi } from '../hooks/useApi';
import { Link } from 'react-router-dom';
import type { BranchStat } from '../api/types';
import { SortableTable, Column } from '../components/SortableTable';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { ErrorMessage } from '../components/ErrorMessage';

interface BranchStatRow extends Record<string, unknown> {
  branch: string;
  eventCount: number;
  successRate: number;
  avgDurationMs: number;
  avgCost: number;
  totalCost: number;
  distinctProjects: number;
  distinctAgents: number;
}

const columns: Column<BranchStatRow>[] = [
  {
    key: 'branch',
    label: 'Branch',
    render: (row) => (
      <Link
        to={`/branches/${encodeURIComponent(row.branch)}`}
        className="text-blue-600 hover:underline"
      >
        {row.branch}
      </Link>
    ),
  },
  { key: 'eventCount', label: 'Events', sortable: true },
  {
    key: 'successRate',
    label: 'Success Rate',
    render: (row) => `${row.successRate.toFixed(1)}%`,
    sortable: true,
  },
  {
    key: 'avgDurationMs',
    label: 'Avg Duration',
    render: (row) => `${row.avgDurationMs.toLocaleString()} ms`,
    sortable: true,
  },
  { key: 'distinctProjects', label: 'Projects', sortable: true },
  { key: 'distinctAgents', label: 'Agents', sortable: true },
  {
    key: 'avgCost',
    label: 'Avg Cost',
    render: (row) => `$${row.avgCost.toFixed(4)}`,
    sortable: true,
  },
  {
    key: 'totalCost',
    label: 'Total Cost',
    render: (row) => `$${row.totalCost.toFixed(4)}`,
    sortable: true,
  },
];

export function BranchesPage() {
  const { data, loading, error, refetch } = useApi<{ data: BranchStat[] }>(
    '/v1/stats/branches',
  );

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorMessage message={error.message} onRetry={refetch} />;

  const rows: BranchStatRow[] = (data?.data ?? []).map((b) => ({ ...b }));

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold text-gray-900">Branches</h2>
      <SortableTable
        columns={columns}
        data={rows}
        defaultSortKey="eventCount"
        defaultSortDir="desc"
        emptyMessage="No branches found."
      />
    </div>
  );
}
