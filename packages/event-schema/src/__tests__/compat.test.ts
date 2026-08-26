import { usageEventSchema } from '../schemas';

const EVENT_ID = '0198f0ea-7a2a-7000-8000-000000000000';
const ROOT_SESSION_ID = '0198f0ea-7a2a-7000-8000-000000000001';

function validEvent(): Record<string, unknown> {
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

describe('UsageEvent Contract Backward Compatibility', () => {
  it('tolerates an additional nested key from a newer producer', () => {
    const future = validEvent();
    future.actor = { userId: 'user-1', teamId: 'added-by-future-collector' };
    const parsed = usageEventSchema.safeParse(future);
    expect(parsed.success).toBe(true);
  });

  it('rejects a hypothetical new top-level key, gating evolution behind a major bump', () => {
    const breaking = { ...validEvent(), telemetryFlags: ['beta'] };
    const parsed = usageEventSchema.safeParse(breaking);
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      const named = parsed.error.issues.some(
        (issue) => issue.code === 'unrecognized_keys' && issue.keys.includes('telemetryFlags'),
      );
      expect(named).toBe(true);
    }
  });
});
