import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import type { EvolutionMetrics } from '../../api/types';

interface EvolutionSectionProps {
  data: EvolutionMetrics;
}

export function EvolutionSection({ data }: EvolutionSectionProps) {
  const agentData = data.byAgentVersion.map((v) => ({
    version: v.version,
    events: v.count,
    successRate: v.count > 0 ? Math.round((v.successCount / v.count) * 100) : 0,
    avgDuration: v.avgDurationMs,
    cost: v.totalCost,
  }));

  const skillData = data.bySkillVersion.map((v) => ({
    version: v.version,
    events: v.count,
    successRate: v.count > 0 ? Math.round((v.successCount / v.count) * 100) : 0,
    cost: v.totalCost,
  }));

  const hasAgentData = agentData.length > 0;
  const hasSkillData = skillData.length > 0;

  if (!hasAgentData && !hasSkillData) {
    return null;
  }

  return (
    <section>
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">Evolution</h2>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {hasAgentData && (
          <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
            <h3 className="mb-3 text-sm font-medium text-gray-700">Agent Versions</h3>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={agentData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="version" tick={{ fontSize: 12 }} />
                <YAxis yAxisId="left" tick={{ fontSize: 12 }} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12 }} />
                <Tooltip />
                <Legend />
                <Bar yAxisId="left" dataKey="events" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Events" />
                <Bar yAxisId="right" dataKey="successRate" fill="#22c55e" radius={[4, 4, 0, 0]} name="Success %" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
        {hasSkillData && (
          <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
            <h3 className="mb-3 text-sm font-medium text-gray-700">Skill Versions</h3>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={skillData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="version" tick={{ fontSize: 12 }} />
                <YAxis yAxisId="left" tick={{ fontSize: 12 }} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12 }} />
                <Tooltip />
                <Legend />
                <Bar yAxisId="left" dataKey="events" fill="#8b5cf6" radius={[4, 4, 0, 0]} name="Events" />
                <Bar yAxisId="right" dataKey="successRate" fill="#22c55e" radius={[4, 4, 0, 0]} name="Success %" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </section>
  );
}
