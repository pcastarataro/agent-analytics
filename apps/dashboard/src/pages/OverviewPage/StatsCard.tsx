interface StatsCardProps {
  value: number;
  label: string;
}

export function StatsCard({ value, label }: StatsCardProps) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
      <p className="text-sm font-medium text-gray-500">{label}</p>
      <p className="mt-1 text-3xl font-bold text-gray-900">{value.toLocaleString()}</p>
    </div>
  );
}
