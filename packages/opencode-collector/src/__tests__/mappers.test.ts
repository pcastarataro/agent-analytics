import type { ExecutionContext, ToolCall, EdgeMap } from '../domain/types';
import type { CollectorConfig } from '../domain/config-schema';
import { mapSessionCreated } from '../mappers/session-mapper';
import { mapUserMessage, mapAssistantMessage } from '../mappers/message-mapper';
import {
  mapToolBefore,
  mapToolAfter,
  mapToolPart,
  mapSkillComplete,
} from '../mappers/tool-skill-mapper';
import { FIXTURES } from '../fixtures/opencode-payloads';

const ROOT_ID = '0198f0ea-7a2a-7000-8000-000000000001';
const CHILD_ID = '0198f0ea-7a2a-7000-8000-000000000002';
const GRANDCHILD_ID = '0198f0ea-7a2a-7000-8000-000000000003';

function createTestConfig(overrides?: Partial<CollectorConfig>): CollectorConfig {
  return {
    url: 'https://analytics.example.com',
    apiKey: 'test-key',
    userId: 'user-1',
    capture: { prompts: false, responses: false, toolArguments: false },
    disabled: false,
    ...overrides,
  };
}

function createContext(overrides?: Partial<ExecutionContext>): ExecutionContext {
  return {
    sessionId: ROOT_ID,
    traceId: ROOT_ID,
    ...overrides,
  };
}

function createToolCalls(): Map<string, ToolCall> {
  return new Map();
}

describe('Session Mapper', () => {
  describe.each([
    [
      'root session sets traceId = self',
      FIXTURES.sessionCreatedRoot,
      (executions: Map<string, ExecutionContext>, edges: EdgeMap) => {
        const ctx = mapSessionCreated(FIXTURES.sessionCreatedRoot, executions, edges);
        expect(ctx.traceId).toBe(ROOT_ID);
        expect(ctx.sessionId).toBe(ROOT_ID);
        expect(ctx.parentId).toBeUndefined();
      },
    ],
    [
      'child session finds root via ancestor walk',
      FIXTURES.sessionCreatedChild,
      (executions: Map<string, ExecutionContext>, edges: EdgeMap) => {
        mapSessionCreated(FIXTURES.sessionCreatedRoot, executions, edges);
        const childCtx = mapSessionCreated(FIXTURES.sessionCreatedChild, executions, edges);
        expect(childCtx.traceId).toBe(ROOT_ID);
        expect(childCtx.parentId).toBe(ROOT_ID);
        expect(childCtx.sessionId).toBe(CHILD_ID);
      },
    ],
    [
      'grandchild walks through intermediate to root',
      FIXTURES.sessionCreatedGrandchild,
      (executions: Map<string, ExecutionContext>, edges: EdgeMap) => {
        mapSessionCreated(FIXTURES.sessionCreatedRoot, executions, edges);
        mapSessionCreated(FIXTURES.sessionCreatedChild, executions, edges);
        const gcCtx = mapSessionCreated(FIXTURES.sessionCreatedGrandchild, executions, edges);
        expect(gcCtx.traceId).toBe(ROOT_ID);
        expect(gcCtx.parentId).toBe(CHILD_ID);
        expect(gcCtx.sessionId).toBe(GRANDCHILD_ID);
      },
    ],
    [
      'subagent traceId = ROOT (not child id)',
      FIXTURES.sessionCreatedChild,
      (executions: Map<string, ExecutionContext>, edges: EdgeMap) => {
        mapSessionCreated(FIXTURES.sessionCreatedRoot, executions, edges);
        const childCtx = mapSessionCreated(FIXTURES.sessionCreatedChild, executions, edges);
        expect(childCtx.traceId).not.toBe(CHILD_ID);
        expect(childCtx.traceId).toBe(ROOT_ID);
      },
    ],
    [
      'parentId set on child, absent on root',
      FIXTURES.sessionCreatedChild,
      (executions: Map<string, ExecutionContext>, edges: EdgeMap) => {
        const rootCtx = mapSessionCreated(FIXTURES.sessionCreatedRoot, executions, edges);
        const childCtx = mapSessionCreated(FIXTURES.sessionCreatedChild, executions, edges);
        expect(rootCtx.parentId).toBeUndefined();
        expect(childCtx.parentId).toBe(ROOT_ID);
      },
    ],
    [
      'parent and child stay separate (cost attribution)',
      FIXTURES.sessionCreatedChild,
      (executions: Map<string, ExecutionContext>, edges: EdgeMap) => {
        mapSessionCreated(FIXTURES.sessionCreatedRoot, executions, edges);
        const childCtx = mapSessionCreated(FIXTURES.sessionCreatedChild, executions, edges);
        expect(childCtx.sessionId).toBe(CHILD_ID);
        expect(childCtx.traceId).toBe(ROOT_ID);
        const rootCtx = executions.get(ROOT_ID)!;
        expect(rootCtx.sessionId).toBe(ROOT_ID);
        expect(rootCtx.traceId).toBe(ROOT_ID);
      },
    ],
  ])('%s', (_name, payload, assertion) => {
    const executions = new Map<string, ExecutionContext>();
    const edges: EdgeMap = new Map();
    assertion(executions, edges);
  });
});

describe('Message Mapper', () => {
  describe('mapUserMessage', () => {
    it.each([
      [
        'default config omits raw prompt',
        FIXTURES.userMessage,
        createTestConfig(),
        (result: Record<string, unknown>) => {
          expect(result).not.toHaveProperty('prompt');
          expect(result).toHaveProperty('promptLength');
          expect(result).toHaveProperty('promptHash');
        },
      ],
      [
        'captures promptLength as UTF-8 byte length',
        FIXTURES.userMessage,
        createTestConfig(),
        (result: Record<string, unknown>) => {
          const encoder = new TextEncoder();
          const expectedBytes = encoder.encode(FIXTURES.userMessage.message.text).length;
          expect(result.promptLength).toBe(expectedBytes);
        },
      ],
      [
        'captures promptHash as sha256 hex',
        FIXTURES.userMessage,
        createTestConfig(),
        (result: Record<string, unknown>) => {
          expect(typeof result.promptHash).toBe('string');
          expect((result.promptHash as string).length).toBe(64);
        },
      ],
      [
        'opt-in captures raw prompt',
        FIXTURES.userMessage,
        createTestConfig({
          capture: { prompts: true, responses: false, toolArguments: false },
        }),
        (result: Record<string, unknown>) => {
          expect(result.prompt).toBe(FIXTURES.userMessage.message.text);
        },
      ],
      [
        'opt-in still omits responses and toolArguments',
        FIXTURES.userMessage,
        createTestConfig({
          capture: { prompts: true, responses: false, toolArguments: false },
        }),
        (result: Record<string, unknown>) => {
          expect(result).not.toHaveProperty('response');
          expect(result).not.toHaveProperty('toolArguments');
        },
      ],
      [
        'sets agent name from payload',
        FIXTURES.userMessage,
        createTestConfig(),
        (result: Record<string, unknown>, ctx: ExecutionContext) => {
          expect(result.agent).toEqual({ name: 'architect' });
          expect(ctx.agentName).toBe('architect');
        },
      ],
      [
        'uses unknown when no agent',
        FIXTURES.userMessageNoAgent,
        createTestConfig(),
        (result: Record<string, unknown>) => {
          expect(result.agent).toEqual({ name: 'unknown' });
        },
      ],
    ])('%s', (_name, payload, config, assertion) => {
      const ctx = createContext();
      const result = mapUserMessage(payload, ctx, config);
      assertion(result, ctx);
    });
  });

  describe('mapAssistantMessage', () => {
    it.each([
      [
        'success maps tokens, status, and duration',
        FIXTURES.assistantMessageSuccess,
        (result: Record<string, unknown>) => {
          expect(result.metrics).toEqual({
            inputTokens: 100,
            outputTokens: 50,
            cachedTokens: 10,
            durationMs: 1000,
          });
          expect(result.result).toEqual({ status: 'success' });
        },
      ],
      [
        'error maps status error',
        FIXTURES.assistantMessageError,
        (result: Record<string, unknown>) => {
          expect(result.result).toEqual({ status: 'error' });
          expect(result.metrics).toHaveProperty('durationMs', 500);
        },
      ],
      [
        'MessageAbortedError maps to cancelled',
        FIXTURES.assistantMessageCancelled,
        (result: Record<string, unknown>) => {
          expect(result.result).toEqual({ status: 'cancelled' });
        },
      ],
      [
        'no tokens produces empty metrics',
        FIXTURES.assistantMessageNoTokens,
        (result: Record<string, unknown>) => {
          expect(result.metrics).toEqual({ durationMs: 50 });
          expect(result.result).toEqual({ status: 'success' });
        },
      ],
      [
        'provider and model IDs included',
        FIXTURES.assistantMessageSuccess,
        (result: Record<string, unknown>) => {
          expect(result.model).toEqual({
            provider: 'openai',
            id: 'gpt-4',
          });
        },
      ],
      [
        'model provider from error fixture',
        FIXTURES.assistantMessageError,
        (result: Record<string, unknown>) => {
          expect(result.model).toEqual({
            provider: 'anthropic',
            id: 'claude-sonnet',
          });
        },
      ],
    ])('%s', (_name, payload, assertion) => {
      const result = mapAssistantMessage(payload);
      assertion(result);
    });
  });
});

describe('Tool-Skill Mapper', () => {
  describe('mapToolBefore', () => {
    it.each([
      [
        'seeds ToolCall by callID',
        FIXTURES.toolExecuteBefore,
        (result: Record<string, unknown>, toolCalls: Map<string, ToolCall>) => {
          expect(result.tool).toEqual({ name: 'read_file' });
          expect(toolCalls.has('call-001')).toBe(true);
          expect(toolCalls.get('call-001')!.toolName).toBe('read_file');
        },
      ],
      [
        'skill tool seeds skill event',
        FIXTURES.skillToolExecuteBefore,
        (result: Record<string, unknown>, toolCalls: Map<string, ToolCall>) => {
          expect(result.skill).toEqual({ name: 'sdd-apply' });
          expect(result.tool).toEqual({ name: 'skill' });
          expect(toolCalls.has('call-002')).toBe(true);
        },
      ],
      [
        'non-skill tool does not seed skill event',
        FIXTURES.toolExecuteBefore,
        (result: Record<string, unknown>) => {
          expect(result).not.toHaveProperty('skill');
        },
      ],
    ])('%s', (_name, payload, assertion) => {
      const toolCalls = createToolCalls();
      const result = mapToolBefore(payload, toolCalls);
      assertion(result, toolCalls);
    });
  });

  describe('mapToolAfter', () => {
    it.each([
      [
        'closes call via callID correlation',
        FIXTURES.toolExecuteAfterSuccess,
        (result: Record<string, unknown>, toolCalls: Map<string, ToolCall>) => {
          const tc = toolCalls.get('call-001')!;
          expect(tc.endTime).toBeDefined();
          expect(tc.status).toBe('success');
          expect(result.tool).toEqual({ name: 'read_file' });
          expect(result.result).toEqual({ status: 'success' });
        },
      ],
      [
        'error result sets status error',
        FIXTURES.toolExecuteAfterError,
        (result: Record<string, unknown>) => {
          expect(result.result).toEqual({ status: 'error' });
        },
      ],
      [
        'unknown callID returns empty',
        FIXTURES.toolExecuteAfterUnknownCallID,
        (result: Record<string, unknown>) => {
          expect(result).toEqual({});
        },
      ],
      [
        'includes durationMs',
        FIXTURES.toolExecuteAfterSuccess,
        (result: Record<string, unknown>) => {
          expect(result.metrics).toHaveProperty('durationMs');
          expect(typeof (result.metrics as Record<string, unknown>).durationMs).toBe('number');
        },
      ],
    ])('%s', (_name, payload, assertion) => {
      const toolCalls = createToolCalls();
      mapToolBefore(FIXTURES.toolExecuteBefore, toolCalls);
      const result = mapToolAfter(payload, toolCalls);
      assertion(result, toolCalls);
    });
  });

  describe('mapToolPart', () => {
    it.each([
      [
        'completed ToolPart maps duration and status',
        FIXTURES.toolPartCompleted,
        (result: Record<string, unknown>) => {
          expect(result.tool).toEqual({ name: 'read_file' });
          expect(result.result).toEqual({ status: 'success' });
          expect(result.metrics).toHaveProperty('durationMs', 500);
        },
      ],
      [
        'error ToolPart sets status error',
        FIXTURES.toolPartError,
        (result: Record<string, unknown>) => {
          expect(result.result).toEqual({ status: 'error' });
        },
      ],
      [
        'no callID falls back to tool name',
        FIXTURES.toolPartNoCallID,
        (result: Record<string, unknown>) => {
          expect(result.tool).toEqual({ name: 'bash' });
          expect(result.result).toEqual({ status: 'success' });
        },
      ],
    ])('%s', (_name, payload, assertion) => {
      const toolCalls = createToolCalls();
      mapToolBefore(FIXTURES.toolExecuteBefore, toolCalls);
      const result = mapToolPart(payload, toolCalls);
      assertion(result);
    });
  });

  describe('mapSkillComplete', () => {
    it.each([
      [
        'skill with version and hash',
        FIXTURES.skillComplete,
        (result: Record<string, unknown>) => {
          expect(result.skill).toEqual({
            name: 'sdd-apply',
            version: '1.2.0',
            definitionHash: 'abc123def',
          });
        },
      ],
      [
        'skill without version omits it',
        FIXTURES.skillCompleteNoVersion,
        (result: Record<string, unknown>) => {
          expect(result.skill).toEqual({ name: 'sdd-apply' });
        },
      ],
    ])('%s', (_name, payload, assertion) => {
      const result = mapSkillComplete(payload);
      assertion(result);
    });
  });
});
