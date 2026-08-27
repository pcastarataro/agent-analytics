import { useState, useCallback, useMemo } from 'react';
import type { SessionEvent } from '../../api/types';
import { GanttTimeAxis } from './GanttTimeAxis';
import { GanttTooltip } from './GanttTooltip';

export interface GanttChartProps {
  events: SessionEvent[];
  width?: number;
  height?: number;
}

const ROW_HEIGHT = 32;
const ROW_GAP = 4;
const PADDING = 60;
const HEADER_HEIGHT = 32;
const MIN_BAR_WIDTH = 2;

const EVENT_COLORS: Record<string, string> = {
  session_created: '#3B82F6',
  user_message: '#10B981',
  assistant_message: '#8B5CF6',
  tool_call: '#F59E0B',
  skill_call: '#14B8A6',
  unknown: '#6B7280',
};

export function GanttChart({ events, width = 800, height }: GanttChartProps) {
  const [hoveredEvent, setHoveredEvent] = useState<SessionEvent | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null);

  // Sort events by timestamp
  const sortedEvents = useMemo(
    () => [...events].sort((a, b) => (a.timestamp ?? '').localeCompare(b.timestamp ?? '')),
    [events],
  );

  // Calculate time range
  const { minTime, maxTime, totalRange } = useMemo(() => {
    if (sortedEvents.length === 0) {
      return { minTime: 0, maxTime: 1, totalRange: 1 };
    }
    const timestamps = sortedEvents
      .map((e) => (e.timestamp ? new Date(e.timestamp).getTime() : 0))
      .filter((t) => t > 0);
    if (timestamps.length === 0) {
      return { minTime: 0, maxTime: 1, totalRange: 1 };
    }
    const min = Math.min(...timestamps);
    const max = Math.max(...timestamps);
    const padding = Math.max((max - min) * 0.1, 1000); // at least 1s padding
    return {
      minTime: min - padding,
      maxTime: max + padding,
      totalRange: max - min + 2 * padding,
    };
  }, [sortedEvents]);

  const chartHeight =
    height ?? HEADER_HEIGHT + sortedEvents.length * (ROW_HEIGHT + ROW_GAP) + 40;

  const handleMouseEnter = useCallback((event: SessionEvent, e: React.MouseEvent) => {
    setHoveredEvent(event);
    const rect = (e.currentTarget.closest('.gantt-container') as HTMLElement)?.getBoundingClientRect();
    if (rect) {
      setTooltipPos({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      });
    }
  }, []);

  const handleMouseLeave = useCallback(() => {
    setHoveredEvent(null);
    setTooltipPos(null);
  }, []);

  if (sortedEvents.length === 0) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-8 text-center text-gray-500">
        No events to display
      </div>
    );
  }

  return (
    <div className="gantt-container relative overflow-x-auto rounded-lg border border-gray-200 bg-white">
      <svg
        width="100%"
        height={chartHeight}
        viewBox={`0 0 ${width} ${chartHeight}`}
        preserveAspectRatio="xMinYMin meet"
        className="min-w-full"
      >
        {/* Time axis */}
        <g transform={`translate(0, ${HEADER_HEIGHT})`}>
          <GanttTimeAxis
            minTime={minTime}
            maxTime={maxTime}
            chartWidth={width}
            padding={PADDING}
          />
        </g>

        {/* Event bars */}
        {sortedEvents.map((event, index) => {
          const ts = event.timestamp ? new Date(event.timestamp).getTime() : 0;
          const durationMs = event.metrics?.durationMs ?? 0;
          const pct = totalRange > 0 ? (ts - minTime) / totalRange : 0;
          const x = PADDING + pct * (width - 2 * PADDING);
          const barWidth =
            durationMs > 0
              ? Math.max((durationMs / totalRange) * (width - 2 * PADDING), MIN_BAR_WIDTH)
              : 0;
          const y = HEADER_HEIGHT + index * (ROW_HEIGHT + ROW_GAP);
          const color = EVENT_COLORS[event.eventType] ?? EVENT_COLORS.unknown;

          return (
            <g
              key={event.id ?? index}
              onMouseEnter={(e) => handleMouseEnter(event, e)}
              onMouseLeave={handleMouseLeave}
              className="cursor-pointer"
            >
              {/* Row background on hover */}
              <rect
                x={0}
                y={y}
                width={width}
                height={ROW_HEIGHT}
                fill="transparent"
                className="hover:fill-gray-50"
                rx={4}
              />

              {/* Row label */}
              <text
                x={8}
                y={y + ROW_HEIGHT / 2 + 4}
                fontSize={11}
                fill="#6B7280"
                fontFamily="monospace"
              >
                {event.eventType}
              </text>

              {/* Bar or dot */}
              {barWidth > 0 ? (
                <rect
                  x={x}
                  y={y + 4}
                  width={barWidth}
                  height={ROW_HEIGHT - 8}
                  fill={color}
                  rx={4}
                  opacity={0.85}
                />
              ) : (
                <circle
                  cx={x}
                  cy={y + ROW_HEIGHT / 2}
                  r={5}
                  fill={color}
                  stroke="white"
                  strokeWidth={2}
                />
              )}
            </g>
          );
        })}
      </svg>

      {/* Tooltip overlay */}
      <GanttTooltip event={hoveredEvent} position={tooltipPos} />

      {/* Color legend */}
      <div className="flex flex-wrap gap-4 border-t border-gray-100 px-4 py-2">
        {Object.entries(EVENT_COLORS).map(([type, color]) => (
          <div key={type} className="flex items-center gap-1.5">
            <span
              className="inline-block h-3 w-3 rounded-sm"
              style={{ backgroundColor: color }}
            />
            <span className="text-xs text-gray-600">{type}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
