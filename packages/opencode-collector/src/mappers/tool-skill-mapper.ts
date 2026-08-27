import type { ToolCall } from '../domain/types';

export function mapToolBefore(
  payload: { input: { callID: string; tool: string; args?: Record<string, unknown> } },
  toolCalls: Map<string, ToolCall>,
): Record<string, unknown> {
  const { callID, tool, args } = payload.input;
  const tc: ToolCall = {
    callID,
    toolName: tool,
    startTime: Date.now(),
  };
  toolCalls.set(callID, tc);

  if (tool === 'skill') {
    const skillName =
      ((args as Record<string, unknown> | undefined)?.name as string) ?? 'unknown';
    tc.skillName = skillName;
    return {
      skill: { name: skillName },
      tool: { name: tool },
    };
  }

  return { tool: { name: tool } };
}

export function mapToolAfter(
  payload: { input: { callID: string }; result?: { error?: boolean } },
  toolCalls: Map<string, ToolCall>,
): Record<string, unknown> {
  const { callID } = payload.input;
  const tc = toolCalls.get(callID);
  if (!tc) return {};

  tc.endTime = Date.now();
  tc.status = payload.result?.error ? 'error' : 'success';

  return {
    tool: { name: tc.toolName },
    ...(tc.skillName !== undefined && { skill: { name: tc.skillName } }),
    metrics: {
      durationMs: tc.endTime - tc.startTime,
    },
    result: { status: tc.status },
  };
}

export function mapToolPart(
  payload: {
    part: {
      callID?: string;
      tool?: string;
      error?: boolean;
      startTime?: number;
      endTime?: number;
    };
  },
  toolCalls: Map<string, ToolCall>,
): Record<string, unknown> {
  const { callID, tool, error, startTime, endTime } = payload.part;

  if (callID !== undefined) {
    const tc = toolCalls.get(callID);
    if (tc) {
      tc.status = error ? 'error' : 'success';
      if (startTime !== undefined && endTime !== undefined) {
        tc.startTime = startTime;
        tc.endTime = endTime;
      }
      return {
        tool: { name: tc.toolName },
        metrics: {
          durationMs: (tc.endTime ?? Date.now()) - tc.startTime,
        },
        result: { status: tc.status },
      };
    }
  }

  return {
    tool: { name: tool ?? 'unknown' },
    result: { status: (error ? 'error' : 'success') as 'success' | 'error' },
  };
}

export function mapSkillComplete(payload: {
  skill: {
    name: string;
    version?: string;
    definitionHash?: string;
  };
}): Record<string, unknown> {
  const { name, version, definitionHash } = payload.skill;
  return {
    skill: {
      name,
      ...(version !== undefined && { version }),
      ...(definitionHash !== undefined && { definitionHash }),
    },
  };
}
