import { useApi } from '../hooks/useApi';
import type { StatsOverview } from '../api/types';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { ErrorMessage } from '../components/ErrorMessage';
import { StatsCard } from './OverviewPage/StatsCard';
import { EventsByAgent } from './OverviewPage/EventsByAgent';
import { EventsByStatus } from './OverviewPage/EventsByStatus';
import { EventsOverTime } from './OverviewPage/EventsOverTime';

export function OverviewPage() {
  const { data, loading, error, refetch } = useApi<StatsOverview>('/v1/stats/overview');

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorMessage message={error.message} onRetry={refetch} />;
  if (!data) return null;

  if (data.total === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-gray-500">
        <p className="text-lg font-medium">No events yet</p>
        <p className="mt-1 text-sm">Events will appear here once the API receives data.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <StatsCard value={data.total} label="Total Events" />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <EventsByAgent data={data.byAgent} />
        <EventsByStatus data={data.byStatus} />
      </div>
      <EventsOverTime data={data.byDate} />
    </div>
  );
}
