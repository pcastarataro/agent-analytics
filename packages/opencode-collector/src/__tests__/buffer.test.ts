import type { UsageEvent } from '@agent-analytics/event-schema';
import { createEventBuffer } from '../infra/event-buffer';
import { createHttpClient } from '../infra/http-client';
import { withBoundary } from '../infra/boundary';

function makeEvent(index: number): UsageEvent {
  return {
    id: `0198f0ea-7a2a-7000-8000-${String(index).padStart(12, '0')}`,
    actor: { userId: 'user-1' },
    project: {},
    session: {},
    execution: { traceId: 'trace-1' },
    agent: { name: 'test' },
    skill: { name: 'test' },
    tool: {},
    model: {},
    metrics: {},
    result: { status: 'success' },
  };
}

function makeConfig(overrides?: Record<string, unknown>) {
  return {
    url: 'https://analytics.example.com',
    apiKey: 'test-key',
    userId: 'user-1',
    capture: { prompts: false, responses: false, toolArguments: false },
    disabled: false,
    ...overrides,
  };
}

describe('EventBuffer', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('flushes when buffer reaches 100 events', async () => {
    const sent: UsageEvent[][] = [];
    const buffer = createEventBuffer({
      flushFn: async (events) => { sent.push(events); },
      clockFn: () => Date.now(),
    });

    for (let i = 0; i < 99; i++) {
      buffer.enqueue(makeEvent(i));
    }
    expect(sent).toHaveLength(0);

    buffer.enqueue(makeEvent(99));
    await buffer.flush();

    expect(sent).toHaveLength(1);
    expect(sent[0]).toHaveLength(100);

    buffer.dispose();
  });

  it('timer flushes after 1s interval', async () => {
    const sent: UsageEvent[][] = [];
    const buffer = createEventBuffer({
      flushFn: async (events) => { sent.push(events); },
      clockFn: () => Date.now(),
    });

    buffer.enqueue(makeEvent(1));
    buffer.enqueue(makeEvent(2));
    expect(sent).toHaveLength(0);

    jest.advanceTimersByTime(1000);
    await Promise.resolve();

    expect(sent).toHaveLength(1);
    expect(sent[0]).toHaveLength(2);

    buffer.dispose();
  });

  it('drops oldest when queue exceeds 10k bound', async () => {
    const sent: UsageEvent[][] = [];
    const buffer = createEventBuffer({
      flushFn: async (events) => { sent.push(events); },
      clockFn: () => Date.now(),
    });

    for (let i = 0; i < 10_000; i++) {
      buffer._buffer.push(makeEvent(i));
    }

    buffer.enqueue(makeEvent(10_000));

    expect(buffer.counters.dropped).toBe(1);

    const allSent = sent.flat();
    expect(allSent.some((e) => e.id === makeEvent(0).id)).toBe(false);
    expect(allSent.some((e) => e.id === makeEvent(10_000).id)).toBe(true);

    buffer.dispose();
  });

  it('dispose drains remaining events', async () => {
    const sent: UsageEvent[][] = [];
    const buffer = createEventBuffer({
      flushFn: async (events) => { sent.push(events); },
      clockFn: () => Date.now(),
    });

    buffer.enqueue(makeEvent(1));
    buffer.enqueue(makeEvent(2));
    buffer.dispose();

    await Promise.resolve();

    expect(sent).toHaveLength(1);
    expect(sent[0]).toHaveLength(2);
  });

  it('session idle triggers flush', async () => {
    const sent: UsageEvent[][] = [];
    const buffer = createEventBuffer({
      flushFn: async (events) => { sent.push(events); },
      clockFn: () => Date.now(),
    });

    buffer.enqueue(makeEvent(1));
    buffer.onSessionIdle();

    await Promise.resolve();

    expect(sent).toHaveLength(1);
    expect(sent[0]).toHaveLength(1);

    buffer.dispose();
  });
});

describe('HttpClient', () => {
  it('sends POST with correct body and headers', async () => {
    let capturedRequest: { url: string; init: RequestInit } | null = null;
    const fetchFn = jest.fn(async (url: string | URL | Request, init?: RequestInit) => {
      capturedRequest = { url: String(url), init: init! };
      return new Response(null, { status: 200 });
    }) as unknown as typeof fetch;

    const config = makeConfig();
    const counters = { dropped: 0, retried: 0 };
    const client = createHttpClient(config, {
      fetchFn,
      clockFn: () => Date.now(),
      sleepFn: jest.fn().mockResolvedValue(undefined),
    }, counters);

    const events = [makeEvent(1), makeEvent(2)];
    await client.postBatch(events);

    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(capturedRequest!.url).toBe('https://analytics.example.com/v1/events/batch');
    expect(capturedRequest!.init.method).toBe('POST');
    expect(capturedRequest!.init.headers).toMatchObject({
      'Content-Type': 'application/json',
      'X-API-Key': 'test-key',
    });

    const body = JSON.parse(capturedRequest!.init.body as string);
    expect(body.events).toHaveLength(2);

    expect(counters.dropped).toBe(0);
    expect(counters.retried).toBe(0);
  });

  it('retries on 5xx then drops after 5 attempts', async () => {
    const fetchFn = jest.fn(async () => new Response(null, { status: 500 })) as unknown as typeof fetch;

    const config = makeConfig();
    const counters = { dropped: 0, retried: 0 };
    const client = createHttpClient(config, {
      fetchFn,
      clockFn: () => Date.now(),
      sleepFn: jest.fn().mockResolvedValue(undefined),
    }, counters);

    await client.postBatch([makeEvent(1)]);

    expect(fetchFn).toHaveBeenCalledTimes(5);
    expect(counters.retried).toBe(4);
    expect(counters.dropped).toBe(1);
  });

  it('retries on network error then drops', async () => {
    const fetchFn = jest.fn(async () => {
      throw new TypeError('Failed to fetch');
    }) as unknown as typeof fetch;

    const config = makeConfig();
    const counters = { dropped: 0, retried: 0 };
    const client = createHttpClient(config, {
      fetchFn,
      clockFn: () => Date.now(),
      sleepFn: jest.fn().mockResolvedValue(undefined),
    }, counters);

    await client.postBatch([makeEvent(1)]);

    expect(fetchFn).toHaveBeenCalledTimes(5);
    expect(counters.dropped).toBe(1);
  });

  it('drops batch immediately on 4xx without retry', async () => {
    const fetchFn = jest.fn(async () => new Response(null, { status: 400 })) as unknown as typeof fetch;

    const config = makeConfig();
    const counters = { dropped: 0, retried: 0 };
    const client = createHttpClient(config, {
      fetchFn,
      clockFn: () => Date.now(),
      sleepFn: jest.fn().mockResolvedValue(undefined),
    }, counters);

    await client.postBatch([makeEvent(1)]);

    expect(fetchFn).toHaveBeenCalledTimes(5);
    expect(counters.dropped).toBe(1);
  });
});

describe('withBoundary', () => {
  it('catches mapper throw and logs first 3 errors', () => {
    const logs: Array<{ service: string; level: string; message: string }> = [];
    const deps = { log: (entry: { service: string; level: string; message: string }) => { logs.push(entry); } };

    const throwingFn = () => { throw new Error('mapper failed'); };
    const wrapped = withBoundary(throwingFn, deps);

    expect(() => wrapped()).not.toThrow();
    expect(() => wrapped()).not.toThrow();
    expect(() => wrapped()).not.toThrow();
    expect(() => wrapped()).not.toThrow();

    expect(logs).toHaveLength(3);
    expect(logs[0]!.message).toContain('Hook error #1');
    expect(logs[1]!.message).toContain('Hook error #2');
    expect(logs[2]!.message).toContain('Hook error #3');
  });

  it('returns void for non-throwing function', () => {
    const deps = { log: jest.fn() };
    const fn = () => 'result';
    const wrapped = withBoundary(fn, deps);

    const result = wrapped();
    expect(result).toBeUndefined();
    expect(deps.log).not.toHaveBeenCalled();
  });

  it('suppresses logs after first 3 errors', () => {
    const logs: Array<{ service: string; level: string; message: string }> = [];
    const deps = { log: (entry: { service: string; level: string; message: string }) => { logs.push(entry); } };

    const throwingFn = () => { throw new Error('fail'); };
    const wrapped = withBoundary(throwingFn, deps);

    for (let i = 0; i < 10; i++) {
      expect(() => wrapped()).not.toThrow();
    }

    expect(logs).toHaveLength(3);
  });
});
