import type { UsageMetrics } from '../../api/types';
import { MetricCard } from './MetricCard';

interface UsageSectionProps {
  data: UsageMetrics;
}

export function UsageSection({ data }: UsageSectionProps) {
  return (
    <section>
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">Usage</h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <MetricCard label="Total Events" value={data.totalEvents} />
        <MetricCard label="Sessions" value={data.distinctSessions} />
        <MetricCard label="Executions" value={data.distinctExecutions} />
        <MetricCard label="Agent Invocations" value={data.agentInvocations} />
        <MetricCard label="Skill Invocations" value={data.skillInvocations} />
        <MetricCard label="Tool Calls" value={data.toolCalls} />
      </div>
    </section>
  );
}
