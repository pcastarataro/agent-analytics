const ROOT_SESSION_ID = '0198f0ea-7a2a-7000-8000-000000000001';
const CHILD_SESSION_ID = '0198f0ea-7a2a-7000-8000-000000000002';
const CHILD2_SESSION_ID = '0198f0ea-7a2a-7000-8000-000000000003';
const CALL_ID_1 = 'call-001';
const CALL_ID_2 = 'call-002';

export const FIXTURES = {
  sessionCreatedRoot: {
    session: { id: ROOT_SESSION_ID },
  },

  sessionCreatedChild: {
    session: { id: CHILD_SESSION_ID, parentID: ROOT_SESSION_ID },
  },

  sessionCreatedGrandchild: {
    session: { id: CHILD2_SESSION_ID, parentID: CHILD_SESSION_ID },
  },

  userMessage: {
    message: { text: 'Hello, analyze this code' },
    agent: 'architect',
  },

  userMessageNoAgent: {
    message: { text: 'Follow-up message' },
  },

  assistantMessageSuccess: {
    message: {
      providerID: 'openai',
      modelID: 'gpt-4',
      tokens: { input: 100, output: 50, cached: 10 },
      startTime: 1000,
      endTime: 2000,
    },
  },

  assistantMessageError: {
    message: {
      providerID: 'anthropic',
      modelID: 'claude-sonnet',
      tokens: { input: 80, output: 20 },
      error: { name: 'ProviderAuthError' },
      startTime: 1000,
      endTime: 1500,
    },
  },

  assistantMessageCancelled: {
    message: {
      providerID: 'openai',
      modelID: 'gpt-4',
      tokens: { input: 60, output: 10 },
      error: { name: 'MessageAbortedError' },
      startTime: 1000,
      endTime: 1200,
    },
  },

  assistantMessageNoTokens: {
    message: {
      providerID: 'openai',
      modelID: 'gpt-4',
      startTime: 1000,
      endTime: 1050,
    },
  },

  toolExecuteBefore: {
    input: { callID: CALL_ID_1, tool: 'read_file', args: { path: '/src/index.ts' } },
  },

  skillToolExecuteBefore: {
    input: { callID: CALL_ID_2, tool: 'skill', args: { name: 'sdd-apply' } },
  },

  toolExecuteAfterSuccess: {
    input: { callID: CALL_ID_1 },
    result: { error: false },
  },

  toolExecuteAfterError: {
    input: { callID: CALL_ID_1 },
    result: { error: true },
  },

  toolExecuteAfterUnknownCallID: {
    input: { callID: 'nonexistent' },
    result: { error: false },
  },

  toolPartCompleted: {
    part: {
      callID: CALL_ID_1,
      tool: 'read_file',
      error: false,
      startTime: 1000,
      endTime: 1500,
    },
  },

  toolPartError: {
    part: {
      callID: 'unknown-call',
      tool: 'write_file',
      error: true,
      startTime: 1000,
      endTime: 1100,
    },
  },

  toolPartNoCallID: {
    part: {
      tool: 'bash',
      error: false,
      startTime: 2000,
      endTime: 2500,
    },
  },

  skillComplete: {
    skill: {
      name: 'sdd-apply',
      version: '1.2.0',
      definitionHash: 'abc123def',
    },
  },

  skillCompleteNoVersion: {
    skill: {
      name: 'sdd-apply',
    },
  },
} as const;
