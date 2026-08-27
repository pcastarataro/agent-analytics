import { useApi } from '../hooks/useApi';
import type { SkillStat } from '../api/types';
import { SortableTable, Column } from '../components/SortableTable';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { ErrorMessage } from '../components/ErrorMessage';

interface SkillStatRow extends Record<string, unknown> {
  skillName: string;
  version: string;
  executionCount: number;
  successRate: number;
  totalCost: number;
}

const columns: Column<SkillStatRow>[] = [
  { key: 'skillName', label: 'Skill' },
  { key: 'version', label: 'Version' },
  { key: 'executionCount', label: 'Executions', sortable: true },
  {
    key: 'successRate',
    label: 'Success Rate',
    render: (row) => `${row.successRate.toFixed(1)}%`,
  },
  {
    key: 'totalCost',
    label: 'Total Cost',
    render: (row) => `$${row.totalCost.toFixed(4)}`,
  },
];

export function SkillsPage() {
  const { data, loading, error, refetch } = useApi<{ data: SkillStat[] }>('/v1/stats/skills');

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorMessage message={error.message} onRetry={refetch} />;

  const rows: SkillStatRow[] = (data?.data ?? []).map((s) => ({ ...s }));

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold text-gray-900">Skills</h2>
      <SortableTable
        columns={columns}
        data={rows}
        defaultSortKey="executionCount"
        defaultSortDir="desc"
        emptyMessage="No skills found."
      />
    </div>
  );
}
