import type { UsageEvent } from '@agent-analytics/event-schema';

export interface BufferCounters {
  dropped: number;
  retried: number;
}

export interface EventBufferDeps {
  flushFn: (events: UsageEvent[]) => Promise<void>;
  clockFn: () => number;
}

const QUEUE_BOUND = 10_000;
const FLUSH_THRESHOLD = 100;
const FLUSH_INTERVAL_MS = 1_000;

export function createEventBuffer(deps: EventBufferDeps) {
  const { flushFn, clockFn } = deps;
  const buffer: UsageEvent[] = [];
  const counters: BufferCounters = { dropped: 0, retried: 0 };
  let timerId: ReturnType<typeof setInterval> | null = null;
  let disposed = false;

  function startTimer(): void {
    if (timerId !== null || disposed) return;
    timerId = setInterval(() => {
      if (buffer.length > 0) {
        void flush();
      }
    }, FLUSH_INTERVAL_MS);
  }

  function enqueue(event: UsageEvent): void {
    if (disposed) return;

    if (buffer.length >= QUEUE_BOUND) {
      buffer.shift();
      counters.dropped++;
    }

    buffer.push(event);

    if (buffer.length >= FLUSH_THRESHOLD) {
      void flush();
    }
  }

  async function flush(): Promise<void> {
    if (buffer.length === 0) return;

    const batch = buffer.splice(0, buffer.length);

    try {
      await flushFn(batch);
    } catch {
      counters.dropped += batch.length;
    }
  }

  function onSessionIdle(): void {
    if (buffer.length > 0) {
      void flush();
    }
  }

  function dispose(): void {
    disposed = true;

    if (timerId !== null) {
      clearInterval(timerId);
      timerId = null;
    }

    if (buffer.length > 0) {
      void flush();
    }
  }

  startTimer();

  return {
    enqueue,
    flush,
    onSessionIdle,
    dispose,
    counters,
    _buffer: buffer,
  };
}
