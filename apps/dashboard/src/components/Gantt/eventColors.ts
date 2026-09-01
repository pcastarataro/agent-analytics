/** Canonical event-type → color mapping used by GanttChart and GanttTooltip. */
export const EVENT_COLORS: Record<string, string> = {
  session_created: '#3B82F6',
  user_message: '#10B981',
  assistant_message: '#8B5CF6',
  tool_call: '#F59E0B',
  skill_call: '#14B8A6',
  unknown: '#6B7280',
};

/** Distinct color palette for entity-based coloring. */
const ENTITY_PALETTE = [
  '#3B82F6', // blue
  '#10B981', // emerald
  '#8B5CF6', // violet
  '#F59E0B', // amber
  '#14B8A6', // teal
  '#EF4444', // red
  '#EC4899', // pink
  '#06B6D4', // cyan
  '#84CC16', // lime
  '#F97316', // orange
  '#6366F1', // indigo
  '#10B981', // emerald (duplicate OK for large sets)
];

/** Simple hash for consistent color assignment. */
function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 31 + str.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

/** Map entity name → consistent color from palette. */
const entityColorCache = new Map<string, string>();

export function getEntityColor(name: string): string {
  const cached = entityColorCache.get(name);
  if (cached) return cached;

  const color = ENTITY_PALETTE[hashString(name) % ENTITY_PALETTE.length] ?? '#6B7280';
  entityColorCache.set(name, color);
  return color;
}

/** Get color for a Gantt event: entity-based when name available, fallback to event type. */
export function getGanttColor(event: {
  eventType: string;
  agent?: { name?: string };
  skill?: { name?: string };
  tool?: Record<string, unknown>;
}): string {
  if (event.eventType === 'tool_call') {
    const toolName = event.tool?.name;
    if (typeof toolName === 'string') return getEntityColor(`tool:${toolName}`);
  }
  if (event.eventType === 'skill_call' && event.skill?.name) {
    return getEntityColor(`skill:${event.skill.name}`);
  }
  if (event.agent?.name) {
    return getEntityColor(`agent:${event.agent.name}`);
  }
  return EVENT_COLORS[event.eventType] ?? EVENT_COLORS.unknown ?? '#6B7280';
}
