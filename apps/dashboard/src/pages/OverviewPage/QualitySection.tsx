import type { QualityMetrics } from '../../api/types';
import { MetricCard } from './MetricCard';

interface QualitySectionProps {
  data: QualityMetrics;
}

export function QualitySection({ data }: QualitySectionProps) {
  return (
    <section>
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">Quality</h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <MetricCard label="Success Rate" value={`${data.successRate.toFixed(1)}%`} subtitle={`${data.successCount} events`} />
        <MetricCard label="Error Rate" value={`${data.errorRate.toFixed(1)}%`} subtitle={`${data.errorCount} events`} />
        <MetricCard label="Cancelled" value={data.cancelledCount} />
        <MetricCard label="Total Retries" value={data.totalRetries} />
        <MetricCard label="Total Events" value={data.successCount + data.errorCount + data.cancelledCount} />
      </div>
    </section>
  );
}
