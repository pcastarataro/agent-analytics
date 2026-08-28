import type { UsageEvent } from '@agent-analytics/event-schema';
import type { CollectorConfig } from '../domain/config-schema';
import type { DefinitionPayload } from '../domain/types';

export interface HttpClientDeps {
  fetchFn: typeof fetch;
  sleepFn: (ms: number) => Promise<void>;
}

const MAX_RETRIES = 5;
const BASE_DELAY_MS = 200;
const CAP_DELAY_MS = 10_000;
const REQUEST_TIMEOUT_MS = 10_000;

export interface HttpClientCounters {
  dropped: number;
  retried: number;
}

export function createHttpClient(
  config: CollectorConfig,
  deps: HttpClientDeps,
  counters: HttpClientCounters,
) {
  const { fetchFn, sleepFn } = deps;

  async function postBatch(events: UsageEvent[]): Promise<void> {
    const body = JSON.stringify(events);

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

      try {
        const res = await fetchFn(`${config.url}/v1/events/batch`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(config.apiKey ? { 'X-API-Key': config.apiKey } : {}),
          },
          body,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (res.ok) return;
        if (res.status >= 400 && res.status < 500) {
          counters.dropped++;
          return;
        }
      } catch {
        clearTimeout(timeoutId);
      }

      if (attempt < MAX_RETRIES - 1) {
        counters.retried++;
        const delay = Math.min(BASE_DELAY_MS * 2 ** attempt, CAP_DELAY_MS);
        const jitter = delay * (Math.random() - 0.5);
        await sleepFn(Math.max(0, delay + jitter));
      }
    }

    counters.dropped++;
  }

  const PUT_MAX_RETRIES = 3;

  async function putDefinition(payload: DefinitionPayload): Promise<void> {
    const body = JSON.stringify({
      content: payload.content,
      entityType: payload.type,
      entityName: payload.name,
      version: payload.version,
    });

    for (let attempt = 0; attempt < PUT_MAX_RETRIES; attempt++) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

      try {
        const res = await fetchFn(`${config.url}/v1/definitions/${payload.hash}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            ...(config.apiKey ? { 'X-API-Key': config.apiKey } : {}),
          },
          body,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (res.ok) return;
        if (res.status >= 400 && res.status < 500) {
          counters.dropped++;
          return;
        }
      } catch {
        clearTimeout(timeoutId);
      }

      if (attempt < PUT_MAX_RETRIES - 1) {
        counters.retried++;
        const delay = Math.min(BASE_DELAY_MS * 2 ** attempt, CAP_DELAY_MS);
        const jitter = delay * (Math.random() - 0.5);
        await sleepFn(Math.max(0, delay + jitter));
      }
    }

    counters.dropped++;
  }

  return { postBatch, putDefinition };
}
