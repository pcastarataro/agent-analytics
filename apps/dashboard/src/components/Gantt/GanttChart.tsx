import { useState, useCallback, useMemo } from 'react';
import type { SessionEvent } from '../../api/types';
import { EVENT_COLORS, getGanttColor } from './eventColors';
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
const DEFAULT_MAX_HEIGHT = 600;

/** Derive a human-readable row label from event context. */
function getRowLabel(event: SessionEvent): string {
  const agentName = event.agent?.name;
  if (event.eventType === 'tool_call') {
    const toolName = (event.tool as Record<string, unknown>)?.name;
    if (toolName != null) return agentName ? `${agentName} / ${toolName}` : String(toolName);
  }
  if (event.eventType === 'skill_call' && event.skill?.name) {
    return agentName ? `${agentName} / ${event.skill.name}` : event.skill.name;
  }
  if (agentName) return `${agentName} / ${event.eventType}`;
  return event.eventType;
}

function getTickInterval(totalRange: number): number {
  if (totalRange > 3600_000) return 600_000;
  if (totalRange > 300_000) return 60_000;
  if (totalRange > 60_000) return 30_000;
  return 10_000;
}

function formatTickLabel(elapsedMs: number, totalRange: number): string {
  const totalSeconds = Math.floor(elapsedMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (totalRange > 3600_000) {
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
  }
  if (totalRange > 60_000) {
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }
  const ms = Math.floor((elapsedMs % 1000) / 10);
  return `${String(seconds).padStart(2, '0')}.${String(ms).padStart(2, '0')}s`;
}

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

  // Compute tick positions for grid lines and time axis labels
  const ticks = useMemo(() => {
    if (totalRange <= 0) return [];
    const interval = getTickInterval(totalRange);
    const startTick = Math.ceil(minTime / interval) * interval;
    const result: { x: number; label: string }[] = [];
    for (let t = startTick; t <= maxTime; t += interval) {
      const pct = (t - minTime) / totalRange;
      result.push({
        x: PADDING + pct * (width - 2 * PADDING),
        label: formatTickLabel(t - minTime, totalRange),
      });
    }
    return result;
  }, [minTime, maxTime, totalRange, width]);

  const eventsContentHeight = sortedEvents.length * (ROW_HEIGHT + ROW_GAP);
  const containerMaxHeight = height ?? DEFAULT_MAX_HEIGHT;

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
    <div
      className="gantt-container relative rounded-lg border border-gray-200 bg-white"
      style={{ maxHeight: containerMaxHeight, overflowY: 'auto' }}
    >
      {/* Sticky time axis */}
      <div
        className="sticky top-0 z-10 bg-white"
        style={{ position: 'sticky', top: 0 }}
      >
        <svg
          width="100%"
          height={HEADER_HEIGHT}
          viewBox={`0 0 ${width} ${HEADER_HEIGHT}`}
          preserveAspectRatio="xMinYMin meet"
          className="min-w-full"
        >
          {ticks.map((tick, i) => (
            <text
              key={i}
              x={tick.x}
              y={20}
              textAnchor="middle"
              fontSize={11}
              fill="#6B7280"
              fontFamily="monospace"
            >
              {tick.label}
            </text>
          ))}
        </svg>
      </div>

      {/* Scrollable event bars with grid lines */}
      <svg
        width="100%"
        height={eventsContentHeight}
        viewBox={`0 0 ${width} ${eventsContentHeight}`}
        preserveAspectRatio="xMinYMin meet"
        className="min-w-full"
      >
        {/* Grid lines */}
        {ticks.map((tick, i) => (
          <line
            key={`grid-${i}`}
            x1={tick.x}
            y1={0}
            x2={tick.x}
            y2={eventsContentHeight}
            stroke="#E5E7EB"
            strokeWidth={1}
            strokeDasharray="4 4"
          />
        ))}

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
          const y = index * (ROW_HEIGHT + ROW_GAP);
          const color = getGanttColor(event);

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
                {getRowLabel(event)}
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

      {/* Sticky color legend */}
      <div
        className="sticky bottom-0 z-10 flex flex-wrap gap-4 border-t border-gray-100 bg-white px-4 py-2"
        style={{ position: 'sticky', bottom: 0 }}
      >
        {sortedEvents.map((event, i) => {
          const label = getRowLabel(event);
          const color = getGanttColor(event);
          // Deduplicate by label
          if (sortedEvents.findIndex((e) => getRowLabel(e) === label) !== i) return null;
          return (
            <div key={label} className="flex items-center gap-1.5">
              <span
                className="inline-block h-3 w-3 rounded-sm"
                style={{ backgroundColor: color }}
              />
              <span className="text-xs text-gray-600">{label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
