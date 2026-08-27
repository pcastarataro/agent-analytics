import type { SessionEvent } from '../../api/types';
import { EVENT_COLORS } from './eventColors';

interface GanttTooltipProps {
  event: SessionEvent | null;
  position: { x: number; y: number } | null;
}

function formatDuration(ms?: number): string {
  if (ms === undefined || ms === null) return 'instant';
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function formatTimestamp(ts?: string): string {
  if (!ts) return '—';
  try {
    return new Date(ts).toLocaleTimeString();
  } catch {
    return ts;
  }
}

export function GanttTooltip({ event, position }: GanttTooltipProps) {
  if (!event || !position) return null;

  const color = EVENT_COLORS[event.eventType] ?? EVENT_COLORS.unknown;

  return (
    <div
      className="pointer-events-none absolute z-50 rounded-lg border border-gray-200 bg-white p-3 shadow-lg"
      style={{
        left: position.x,
        top: position.y,
        transform: 'translate(12px, -50%)',
      }}
    >
      <div className="flex items-center gap-2">
        <span
          className="inline-block h-3 w-3 rounded-full"
          style={{ backgroundColor: color }}
        />
        <span className="text-sm font-medium text-gray-900">{event.eventType as string}</span>
      </div>
      <div className="mt-1 space-y-0.5 text-xs text-gray-500">
        {event.eventType === 'tool_call' && (event.tool as Record<string, unknown>)?.name != null && (
          <p>Tool: {String((event.tool as Record<string, unknown>).name)}</p>
        )}
        <p>Duration: {formatDuration(event.metrics?.durationMs)}</p>
        <p>Time: {formatTimestamp(event.timestamp)}</p>
        <p>Status: {event.result?.status}</p>
      </div>
    </div>
  );
}
