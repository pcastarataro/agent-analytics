import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';

interface EventsByStatusProps {
  data: Record<string, number>;
}

const COLORS: Record<string, string> = {
  success: '#22c55e',
  error: '#ef4444',
  cancelled: '#f59e0b',
};

const DEFAULT_COLORS = ['#3b82f6', '#8b5cf6', '#06b6d4', '#f97316', '#ec4899'];

export function EventsByStatus({ data }: EventsByStatusProps) {
  const chartData = Object.entries(data).map(([name, value]) => ({ name, value }));

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <h3 className="mb-3 text-sm font-medium text-gray-700">Events by Status</h3>
      <ResponsiveContainer width="100%" height={240}>
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            innerRadius={50}
            outerRadius={80}
            dataKey="value"
            label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
          >
            {chartData.map((entry, i) => (
              <Cell
                key={entry.name}
                fill={COLORS[entry.name] ?? DEFAULT_COLORS[i % DEFAULT_COLORS.length]}
              />
            ))}
          </Pie>
          <Tooltip />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
