import { randomFillSync } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { usageEventSchema, type UsageEvent } from '@agent-analytics/event-schema';
import {
  collectorConfigSchema,
  ENV_URL,
  ENV_API_KEY,
  ENV_USER,
  ENV_DISABLED,
  type CollectorConfig,
} from './domain/config-schema';
import type { ExecutionContext, ToolCall, EdgeMap } from './domain/types';
import {
  mapSessionCreated,
  mapUserMessage,
  mapAssistantMessage,
  mapToolBefore,
  mapToolAfter,
} from './mappers';
import { createEventBuffer, type EventBufferDeps } from './infra/event-buffer';
import { createHttpClient, type HttpClientCounters } from './infra/http-client';
import { withBoundary } from './infra/boundary';

export const OPENCODE_COLLECTOR_PACKAGE_NAME = '@agent-analytics/opencode-collector';

export function dependencyPackageNames(): string[] {
  return ['@agent-analytics/event-schema', '@agent-analytics/shared'];
}

function resolveConfig(directory: string): CollectorConfig {
  const env: Record<string, string | undefined> = {};
  env[ENV_URL] = process.env[ENV_URL];
  env[ENV_API_KEY] = process.env[ENV_API_KEY];
  env[ENV_USER] = process.env[ENV_USER];
  env[ENV_DISABLED] = process.env[ENV_DISABLED];

  let fileConfig: Record<string, unknown> | undefined;
  try {
    const raw = readFileSync(join(directory, '.opencode', 'analytics.json'), 'utf-8');
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    fileConfig = parsed.collector as Record<string, unknown> | undefined;
  } catch {
    // File absent or malformed — file layer stays undefined
  }

  const merged: Record<string, unknown> = {};
  if (fileConfig) Object.assign(merged, fileConfig);
  if (env[ENV_URL]) merged.url = env[ENV_URL];
  if (env[ENV_API_KEY]) merged.apiKey = env[ENV_API_KEY];
  if (env[ENV_USER]) merged.userId = env[ENV_USER];
  if (env[ENV_DISABLED] === 'true') merged.disabled = true;

  const parsed = collectorConfigSchema.safeParse(merged);
  const config = parsed.success ? parsed.data : collectorConfigSchema.parse({});

  if (!config.url) config.disabled = true;

  return Object.freeze(config) as CollectorConfig;
}

function generateId(): string {
  const ms = Date.now();
  const buf = Buffer.alloc(16);
  // 48-bit timestamp
  buf.writeUInt32BE(Math.floor(ms / 0x10000), 0);
  buf.writeUInt16BE(ms & 0xffff, 4);
  // version 7
  buf.writeUInt8((buf.readUInt8(6) & 0x0f) | 0x70, 6);
  // variant 10xx
  buf.writeUInt8((buf.readUInt8(8) & 0x3f) | 0x80, 8);
  // random bytes for remaining bits
  randomFillSync(buf, 9);
  const hex = buf.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

export const createPlugin = async ({
  client,
  directory,
}: {
  project: unknown;
  client: {
    app: {
      log: (entry: {
        body: { service: string; level: string; message: string; hooks?: string[] };
      }) => Promise<void>;
    };
    session: { messages: (args: { id: string }) => Promise<unknown[]> };
  };
  $: unknown;
  directory: string;
  worktree: string;
}) => {
  const config = resolveConfig(directory);

  if (config.disabled) {
    await client.app.log({
      body: {
        service: 'opencode-collector',
        level: 'info',
        message: 'Collector disabled (no endpoint configured)',
      },
    });
    return {};
  }

  const logFn = (entry: { service: string; level: string; message: string }) => {
    void client.app.log({ body: entry });
  };

  const executions = new Map<string, ExecutionContext>();
  const edges: EdgeMap = new Map();
  const toolCalls = new Map<string, ToolCall>();
  const counters: HttpClientCounters = { dropped: 0, retried: 0 };

  const httpClient = createHttpClient(
    config,
    {
      fetchFn: globalThis.fetch,
      sleepFn: (ms: number) => new Promise((r) => setTimeout(r, Math.max(0, ms))),
    },
    counters,
  );

  const bufferDeps: EventBufferDeps = {
    flushFn: async (events: UsageEvent[]) => {
      await httpClient.postBatch(events);
    },
  };
  const buffer = createEventBuffer(bufferDeps);

  function enqueueEvent(fields: Record<string, unknown>): void {
    const event: UsageEvent = {
      id: generateId(),
      actor: { userId: config.userId ?? 'anonymous' },
      project: {},
      session: {},
      execution: { traceId: '' },
      agent: { name: 'unknown' },
      skill: { name: 'unknown' },
      tool: {},
      model: {},
      metrics: {},
      result: { status: 'success' },
      ...fields,
    } as UsageEvent;

    const result = usageEventSchema.safeParse(event);
    if (result.success) {
      buffer.enqueue(result.data);
    } else {
      logFn({
        service: 'opencode-collector',
        level: 'warn',
        message: `Invalid event dropped: ${result.error.message}`,
      });
      counters.dropped++;
    }
  }

  function handleSessionCreated(input: unknown): void {
    const payload = input as { session: { id: string; parentID?: string } };
    const ctx = mapSessionCreated(payload, executions, edges);
    enqueueEvent({
      session: { id: ctx.sessionId },
      execution: { traceId: ctx.traceId, parentId: ctx.parentId },
      agent: { name: ctx.agentName ?? 'unknown' },
    });
  }

  function handleMessageUpdated(input: unknown): void {
    const payload = input as {
      type: string;
      sessionID?: string;
      message?: Record<string, unknown>;
    };
    if (payload.type !== 'user' && payload.type !== 'assistant') return;
    if (!payload.sessionID) return;

    const ctx = executions.get(payload.sessionID);
    if (!ctx) return;

    const fields =
      payload.type === 'user'
        ? mapUserMessage(
            payload as unknown as { message: { text: string }; agent?: string },
            ctx,
            config,
          )
        : mapAssistantMessage(
            payload as unknown as {
              message: {
                providerID?: string;
                modelID?: string;
                tokens?: { input?: number; output?: number; cached?: number };
                error?: { name?: string } | null;
                startTime?: number;
                endTime?: number;
              };
            },
          );

    enqueueEvent({
      session: { id: ctx.sessionId },
      execution: { traceId: ctx.traceId, parentId: ctx.parentId },
      ...fields,
    });
  }

  function handleToolBefore(input: unknown): void {
    const payload = input as {
      input: { callID: string; tool: string; args?: Record<string, unknown>; sessionID?: string };
    };
    const fields = mapToolBefore(payload, toolCalls);

    // Prefer sessionID from the hook payload; fall back to first active execution
    const sessionId = payload.input.sessionID
      ?? (executions.size > 0 ? [...executions.keys()]![0] : undefined);
    const ctx = sessionId ? executions.get(sessionId) : undefined;

    enqueueEvent({
      session: ctx ? { id: ctx.sessionId } : {},
      execution: ctx ? { traceId: ctx.traceId, parentId: ctx.parentId } : { traceId: '' },
      ...fields,
    });
  }

  function handleToolAfter(input: unknown): void {
    const payload = input as {
      input: { callID: string; sessionID?: string };
      result?: { error?: boolean };
    };
    const fields = mapToolAfter(payload, toolCalls);
    if (Object.keys(fields).length === 0) return;

    // Prefer sessionID from the hook payload; fall back to first active execution
    const sessionId = payload.input.sessionID
      ?? (executions.size > 0 ? [...executions.keys()]![0] : undefined);
    const ctx = sessionId ? executions.get(sessionId) : undefined;

    enqueueEvent({
      session: ctx ? { id: ctx.sessionId } : {},
      execution: ctx ? { traceId: ctx.traceId, parentId: ctx.parentId } : { traceId: '' },
      ...fields,
    });
  }

  async function handleSessionIdle(input: unknown): Promise<void> {
    const payload = input as { sessionID?: string };
    if (payload.sessionID) {
      executions.delete(payload.sessionID);
    }
    buffer.onSessionIdle();
  }

  const hooks = {
    'session.created': withBoundary(handleSessionCreated, { log: logFn }),
    'message.updated': withBoundary(handleMessageUpdated, { log: logFn }),
    'tool.execute.before': withBoundary(handleToolBefore, { log: logFn }),
    'tool.execute.after': withBoundary(handleToolAfter, { log: logFn }),
    'session.idle': withBoundary(handleSessionIdle as unknown as (...args: unknown[]) => void, {
      log: logFn,
    }),
  };

  await client.app.log({
    body: {
      service: 'opencode-collector',
      level: 'info',
      message: 'Collector started',
      hooks: Object.keys(hooks),
    },
  });

  return hooks;
};
