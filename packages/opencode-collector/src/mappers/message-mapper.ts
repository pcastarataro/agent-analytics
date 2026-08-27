import { createHash } from 'node:crypto';
import type { ExecutionContext } from '../domain/types';
import type { CollectorConfig } from '../domain/config-schema';
import type { EventStatus } from '@agent-analytics/event-schema';
import { extractTokenMetrics, resolveStatus } from '@agent-analytics/event-schema';

function computePromptPrivacy(
  text: string,
): {
  promptLength: number;
  promptHash: string;
} {
  const encoder = new TextEncoder();
  const bytes = encoder.encode(text);
  const hash = createHash('sha256').update(bytes).digest('hex');
  return { promptLength: bytes.length, promptHash: hash };
}

export function mapUserMessage(
  payload: {
    message: { text: string };
    agent?: string;
  },
  context: ExecutionContext,
  config: CollectorConfig,
): Record<string, unknown> {
  const privacy = computePromptPrivacy(payload.message.text);

  if (payload.agent && !context.agentName) {
    context.agentName = payload.agent;
  }

  context.eventType = 'user_message';

  return {
    agent: { name: context.agentName ?? 'unknown' },
    metrics: {
      inputTokens: 0,
      outputTokens: 0,
      promptLength: privacy.promptLength,
      promptHash: privacy.promptHash,
    },
    result: { status: 'success' as EventStatus },
  };
}

/**
 * Maps an assistant message from the OpenCode SDK's AssistantMessage shape.
 *
 * SDK shape:
 *   { providerID, modelID, tokens: { input, output, reasoning, cache: { read, write } },
 *     cost, time: { created, completed? }, error? }
 */
export function mapAssistantMessage(
  payload: {
    message: {
      providerID?: string;
      modelID?: string;
      tokens?: {
        input?: number;
        output?: number;
        reasoning?: number;
        cache?: { read?: number; write?: number };
      };
      cost?: number;
      error?: { name?: string } | null;
      time?: { created?: number; completed?: number };
      // Legacy fields (pre-SDK) — tolerated for backwards compat
      startTime?: number;
      endTime?: number;
      cached?: number;
    };
  },
  context: ExecutionContext,
): Record<string, unknown> {
  const msg = payload.message;

  // Map SDK token shape { cache.read } → canonical { cached }
  // Also tolerates legacy shape { cached } directly on tokens
  const tokenShape = msg.tokens
    ? {
        input: msg.tokens.input,
        output: msg.tokens.output,
        cached: msg.tokens.cache?.read ?? (msg.tokens as Record<string, unknown>).cached as number | undefined,
      }
    : undefined;
  const tokenMetrics = extractTokenMetrics(tokenShape);
  const status: EventStatus = resolveStatus(msg.error);

  // Prefer SDK time shape { created, completed }; fall back to legacy startTime/endTime
  const startTime = msg.time?.created ?? msg.startTime;
  const endTime = msg.time?.completed ?? msg.endTime;
  const durationMs =
    startTime !== undefined && endTime !== undefined ? endTime - startTime : undefined;

  context.eventType = 'assistant_message';

  return {
    model: {
      ...(msg.providerID !== undefined && { provider: msg.providerID }),
      ...(msg.modelID !== undefined && { id: msg.modelID }),
    },
    metrics: {
      ...tokenMetrics,
      ...(durationMs !== undefined && { durationMs }),
      ...(msg.cost !== undefined && { cost: msg.cost }),
    },
    result: { status },
  };
}
