import { z } from 'zod';

import { usageEventSchema } from '../schemas';

const EVENT_ID = '0198f0ea-7a2a-7000-8000-000000000000';
const ROOT_SESSION_ID = '0198f0ea-7a2a-7000-8000-000000000001';
const CHILD_EXEC_EVENT_ID = '0198f0ea-7a2a-7000-8000-000000000002';
const UUID_V4_ID = '9b2f1c5e-0000-4000-8000-000000000000';

type EventInput = Record<string, unknown>;

// Minimal event: valid id + all ten groups carrying only their mandatory fields.
function baseEvent(): EventInput {
  return {
    id: EVENT_ID,
    actor: { userId: 'user-1' },
    project: {},
    session: {},
    execution: { traceId: ROOT_SESSION_ID },
    agent: { name: 'build' },
    skill: { name: 'lint' },
    tool: {},
    model: {},
    metrics: {},
    result: { status: 'success' },
  };
}

function failureOf(value: unknown): z.ZodError {
  const parsed = usageEventSchema.safeParse(value);
  if (parsed.success) {
    throw new Error('Expected schema to reject the input');
  }
  return parsed.error;
}

function unrecognizedTopLevelKeys(error: z.ZodError): readonly PropertyKey[] {
  for (const issue of error.issues) {
    if (issue.code === 'unrecognized_keys') {
      return issue.keys;
    }
  }
  return [];
}

function hasPath(error: z.ZodError, path: PropertyKey[]): boolean {
  return error.issues.some(
    (issue) =>
      issue.path.length === path.length && path.every((segment, i) => issue.path[i] === segment),
  );
}

describe('Canonical UsageEvent Zod Contract', () => {
  it('accepts a minimal valid event and round-trips its value', () => {
    const input = baseEvent();
    expect(usageEventSchema.parse(input)).toEqual(input);
  });

  it('rejects an unknown top-level key and names it', () => {
    const input = { ...baseEvent(), extra: { note: 'future producer field' } };
    expect(unrecognizedTopLevelKeys(failureOf(input))).toEqual(['extra']);
  });

  it('reports the exact path for a missing mandatory field such as result.status', () => {
    const input = baseEvent();
    delete (input.result as Record<string, unknown>).status;
    expect(hasPath(failureOf(input), ['result', 'status'])).toBe(true);
  });
});

describe('Field-Level Contract Rules', () => {
  it('accepts a valid UUIDv7 id whose traceId equals the root session id without parentId', () => {
    const input: EventInput = {
      ...baseEvent(),
      id: CHILD_EXEC_EVENT_ID,
      execution: { traceId: ROOT_SESSION_ID },
    };
    expect(usageEventSchema.safeParse(input).success).toBe(true);
  });

  it('rejects an id that is not a valid UUIDv7', () => {
    const malformed = failureOf({ ...baseEvent(), id: 'not-a-uuid' });
    const wrongVersion = failureOf({ ...baseEvent(), id: UUID_V4_ID });
    expect(hasPath(malformed, ['id'])).toBe(true);
    expect(hasPath(wrongVersion, ['id'])).toBe(true);
  });

  it('rejects a metrics.cost that is not a number', () => {
    const input = baseEvent();
    input.metrics = { cost: '12.50' };
    expect(hasPath(failureOf(input), ['metrics', 'cost'])).toBe(true);
  });
});

describe('eventType Field Contract', () => {
  const EVENT_TYPES = [
    'session_created',
    'user_message',
    'assistant_message',
    'tool_call',
    'skill_call',
  ] as const;

  it.each(EVENT_TYPES)('accepts eventType=%s in execution', (eventType) => {
    const input = { ...baseEvent(), execution: { traceId: ROOT_SESSION_ID, eventType } };
    expect(usageEventSchema.safeParse(input).success).toBe(true);
  });

  it('rejects an invalid eventType value', () => {
    const input = {
      ...baseEvent(),
      execution: { traceId: ROOT_SESSION_ID, eventType: 'invalid_type' },
    };
    const parsed = usageEventSchema.safeParse(input);
    expect(parsed.success).toBe(false);
  });

  it('accepts events without eventType (backward compatibility)', () => {
    const input = baseEvent();
    const parsed = usageEventSchema.parse(input);
    expect(parsed.execution.eventType).toBeUndefined();
  });
});
