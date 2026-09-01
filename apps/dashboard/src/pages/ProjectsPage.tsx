import { useApi } from '../hooks/useApi';
import { Link } from 'react-router-dom';
import type { ProjectStat } from '../api/types';
import { SortableTable, Column } from '../components/SortableTable';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { ErrorMessage } from '../components/ErrorMessage';

interface ProjectStatRow extends Record<string, unknown> {
  projectName: string;
  eventCount: number;
  successRate: number;
  avgDurationMs: number;
  avgCost: number;
  totalCost: number;
  distinctBranches: number;
  distinctAgents: number;
}

const columns: Column<ProjectStatRow>[] = [
  {
    key: 'projectName',
    label: 'Project',
    render: (row) => (
      <Link
        to={`/projects/${encodeURIComponent(row.projectName)}`}
        className="text-blue-600 hover:underline"
      >
        {row.projectName}
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
  { key: 'distinctBranches', label: 'Branches', sortable: true },
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

export function ProjectsPage() {
  const { data, loading, error, refetch } = useApi<{ data: ProjectStat[] }>(
    '/v1/stats/projects',
  );

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorMessage message={error.message} onRetry={refetch} />;

  const rows: ProjectStatRow[] = (data?.data ?? []).map((p) => ({ ...p }));

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold text-gray-900">Projects</h2>
      <SortableTable
        columns={columns}
        data={rows}
        defaultSortKey="eventCount"
        defaultSortDir="desc"
        emptyMessage="No projects found."
      />
    </div>
  );
}
