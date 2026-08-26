import { createHash } from 'node:crypto';
import type { ExecutionContext } from '../domain/types';
import type { CollectorConfig } from '../domain/config-schema';
import type { EventStatus } from '@agent-analytics/event-schema';
import { extractTokenMetrics, resolveStatus } from '@agent-analytics/event-schema';

function computePromptPrivacy(text: string, capturePrompts: boolean): {
  prompt?: string;
  promptLength: number;
  promptHash: string;
} {
  const encoder = new TextEncoder();
  const bytes = encoder.encode(text);
  const hash = createHash('sha256').update(bytes).digest('hex');
  return capturePrompts
    ? { prompt: text, promptLength: bytes.length, promptHash: hash }
    : { promptLength: bytes.length, promptHash: hash };
}

export function mapUserMessage(
  payload: {
    message: { text: string };
    agent?: string;
  },
  context: ExecutionContext,
  config: CollectorConfig,
): Record<string, unknown> {
  const privacy = computePromptPrivacy(
    payload.message.text,
    config.capture.prompts,
  );

  if (payload.agent && !context.agentName) {
    context.agentName = payload.agent;
  }

  return {
    agent: { name: context.agentName ?? 'unknown' },
    metrics: {
      inputTokens: 0,
      outputTokens: 0,
    },
    result: { status: 'success' as EventStatus },
    ...privacy,
  };
}

export function mapAssistantMessage(
  payload: {
    message: {
      providerID?: string;
      modelID?: string;
      tokens?: { input?: number; output?: number; cached?: number };
      error?: { name?: string } | null;
      startTime?: number;
      endTime?: number;
    };
  },
): Record<string, unknown> {
  const msg = payload.message;
  const tokenMetrics = extractTokenMetrics(msg.tokens);
  const status: EventStatus = resolveStatus(msg.error);

  const durationMs =
    msg.startTime !== undefined && msg.endTime !== undefined
      ? msg.endTime - msg.startTime
      : undefined;

  return {
    model: {
      ...(msg.providerID !== undefined && { provider: msg.providerID }),
      ...(msg.modelID !== undefined && { id: msg.modelID }),
    },
    metrics: {
      ...tokenMetrics,
      ...(durationMs !== undefined && { durationMs }),
    },
    result: { status },
  };
}
