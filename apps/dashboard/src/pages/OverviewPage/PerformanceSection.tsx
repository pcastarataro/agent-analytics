import type { PerformanceMetrics } from '../../api/types';
import { MetricCard } from './MetricCard';

function formatDuration(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60_000).toFixed(1)}m`;
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function formatCost(n: number): string {
  if (n === 0) return '$0';
  if (n < 0.01) return `$${n.toFixed(4)}`;
  return `$${n.toFixed(2)}`;
}

interface PerformanceSectionProps {
  data: PerformanceMetrics;
}

export function PerformanceSection({ data }: PerformanceSectionProps) {
  return (
    <section>
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">Performance</h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <MetricCard label="Avg Duration" value={formatDuration(data.avgDurationMs)} />
        <MetricCard label="Total Duration" value={formatDuration(data.totalDurationMs)} />
        <MetricCard label="Total Tokens" value={formatTokens(data.totalInputTokens + data.totalOutputTokens)} subtitle={`in: ${formatTokens(data.totalInputTokens)} / out: ${formatTokens(data.totalOutputTokens)}`} />
        <MetricCard label="Total Cost" value={formatCost(data.totalCost)} subtitle={`avg: ${formatCost(data.avgCost)}`} />
      </div>
    </section>
  );
}
