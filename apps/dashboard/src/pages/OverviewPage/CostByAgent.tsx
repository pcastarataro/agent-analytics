import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import type { AgentStat } from '../../api/types';

export interface CostByAgentProps {
  data: AgentStat[];
}

export function CostByAgent({ data }: CostByAgentProps) {
  const chartData = data
    .filter((agent) => agent.totalCost > 0)
    .map((agent) => ({
      name: agent.agentName,
      cost: agent.totalCost,
    }));

  if (chartData.length === 0) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <h3 className="mb-3 text-sm font-medium text-gray-700">Cost by Agent</h3>
        <p className="text-sm text-gray-500">No cost data</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <h3 className="mb-3 text-sm font-medium text-gray-700">Cost by Agent</h3>
      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={chartData} layout="vertical">
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis type="number" tickFormatter={(v: number) => `$${v.toFixed(4)}`} tick={{ fontSize: 12 }} />
          <YAxis dataKey="name" type="category" tick={{ fontSize: 12 }} width={100} />
          <Tooltip formatter={(value: number) => `$${value.toFixed(4)}`} />
          <Bar dataKey="cost" fill="#3b82f6" radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
