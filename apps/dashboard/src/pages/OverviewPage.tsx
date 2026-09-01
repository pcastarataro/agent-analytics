import { useApi } from '../hooks/useApi';
import type { StatsOverview } from '../api/types';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { ErrorMessage } from '../components/ErrorMessage';
import { UsageSection } from './OverviewPage/UsageSection';
import { PerformanceSection } from './OverviewPage/PerformanceSection';
import { QualitySection } from './OverviewPage/QualitySection';
import { EventsByAgent } from './OverviewPage/EventsByAgent';
import { CostByAgent } from './OverviewPage/CostByAgent';
import { EventsOverTime } from './OverviewPage/EventsOverTime';
import type { AgentStat } from '../api/types';

export function OverviewPage() {
  const { data, loading, error, refetch } = useApi<StatsOverview>('/v1/stats/overview');
  const { data: agentsData } = useApi<{ data: AgentStat[] }>('/v1/stats/agents');

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorMessage message={error.message} onRetry={refetch} />;
  if (!data) return null;

  if (data.usage.totalEvents === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-gray-500">
        <p className="text-lg font-medium">No events yet</p>
        <p className="mt-1 text-sm">Events will appear here once the API receives data.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <UsageSection data={data.usage} />
      <PerformanceSection data={data.performance} />
      <QualitySection data={data.quality} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <EventsByAgent data={data.byAgent} />
        <CostByAgent data={agentsData?.data ?? []} />
      </div>
      <EventsOverTime data={data.byDate} />
    </div>
  );
}
