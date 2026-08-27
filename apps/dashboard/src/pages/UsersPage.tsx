import { useApi } from '../hooks/useApi';
import type { UserStat } from '../api/types';
import { SortableTable, Column } from '../components/SortableTable';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { ErrorMessage } from '../components/ErrorMessage';

interface UserStatRow extends Record<string, unknown> {
  userId: string;
  eventCount: number;
  distinctAgents: number;
  distinctSkills: number;
  firstSeenAt: string;
  lastSeenAt: string;
}

function formatDate(val: unknown): string {
  if (!val) return '—';
  try {
    return new Date(String(val)).toLocaleString();
  } catch {
    return '—';
  }
}

const columns: Column<UserStatRow>[] = [
  { key: 'userId', label: 'User' },
  { key: 'eventCount', label: 'Events', sortable: true },
  { key: 'distinctAgents', label: 'Agents', sortable: true },
  { key: 'distinctSkills', label: 'Skills', sortable: true },
  {
    key: 'firstSeenAt',
    label: 'First Seen',
    render: (row) => formatDate(row.firstSeenAt),
  },
  {
    key: 'lastSeenAt',
    label: 'Last Seen',
    render: (row) => formatDate(row.lastSeenAt),
  },
];

export function UsersPage() {
  const { data, loading, error, refetch } = useApi<{ data: UserStat[] }>('/v1/stats/users');

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorMessage message={error.message} onRetry={refetch} />;

  const rows: UserStatRow[] = (data?.data ?? []).map((u) => ({ ...u }));

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold text-gray-900">Users</h2>
      <SortableTable
        columns={columns}
        data={rows}
        defaultSortKey="eventCount"
        defaultSortDir="desc"
        emptyMessage="No users found."
      />
    </div>
  );
}
