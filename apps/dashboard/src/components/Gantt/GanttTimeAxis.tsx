interface GanttTimeAxisProps {
  minTime: number;
  maxTime: number;
  chartWidth: number;
  padding: number;
}

function formatTimeLabel(elapsedMs: number, totalRange: number): string {
  const totalSeconds = Math.floor(elapsedMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  // Adaptive granularity based on total range
  if (totalRange > 3600_000) {
    // > 1 hour → show hours:minutes
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
  }
  if (totalRange > 60_000) {
    // > 1 min → show minutes:seconds
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }
  // Short sessions → show seconds with ms
  const ms = Math.floor((elapsedMs % 1000) / 10);
  return `${String(seconds).padStart(2, '0')}.${String(ms).padStart(2, '0')}s`;
}

function getTickInterval(totalRange: number): number {
  if (totalRange > 3600_000) return 600_000; // 10 min ticks
  if (totalRange > 300_000) return 60_000; // 1 min ticks
  if (totalRange > 60_000) return 30_000; // 30s ticks
  return 10_000; // 10s ticks
}

export function GanttTimeAxis({ minTime, maxTime, chartWidth, padding }: GanttTimeAxisProps) {
  const totalRange = maxTime - minTime;
  const interval = getTickInterval(totalRange);
  const startTick = Math.ceil(minTime / interval) * interval;

  const ticks: { x: number; label: string }[] = [];
  for (let t = startTick; t <= maxTime; t += interval) {
    const pct = (t - minTime) / totalRange;
    const x = padding + pct * (chartWidth - 2 * padding);
    ticks.push({ x, label: formatTimeLabel(t - minTime, totalRange) });
  }

  return (
    <g className="gantt-time-axis">
      {ticks.map((tick, i) => (
        <g key={i}>
          <line
            x1={tick.x}
            y1={0}
            x2={tick.x}
            y2={2000}
            stroke="#E5E7EB"
            strokeWidth={1}
            strokeDasharray="4 4"
          />
          <text
            x={tick.x}
            y={20}
            textAnchor="middle"
            fontSize={11}
            fill="#6B7280"
            fontFamily="monospace"
          >
            {tick.label}
          </text>
        </g>
      ))}
    </g>
  );
}
