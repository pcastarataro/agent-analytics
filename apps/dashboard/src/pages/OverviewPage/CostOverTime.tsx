import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

interface CostOverTimeProps {
  data: Array<{ date: string; cost: number }>;
}

export function CostOverTime({ data }: CostOverTimeProps) {
  const chartData = data
    .filter((d) => d.cost > 0)
    .sort((a, b) => a.date.localeCompare(b.date));

  if (chartData.length === 0) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <h3 className="mb-3 text-sm font-medium text-gray-700">Cost Over Time</h3>
        <p className="text-sm text-gray-500">No cost data available.</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <h3 className="mb-3 text-sm font-medium text-gray-700">Cost Over Time</h3>
      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="date" tick={{ fontSize: 12 }} />
          <YAxis tick={{ fontSize: 12 }} tickFormatter={(v: number) => `$${v.toFixed(2)}`} />
          <Tooltip formatter={(value: number) => `$${value.toFixed(4)}`} />
          <Bar dataKey="cost" fill="#10b981" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
