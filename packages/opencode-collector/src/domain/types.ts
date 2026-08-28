export interface ExecutionContext {
  sessionId: string;
  traceId: string;
  parentId?: string;
  agentName?: string;
  version?: string;
  definitionHash?: string;
  eventType?: 'session_created' | 'user_message' | 'assistant_message' | 'tool_call' | 'skill_call';
}

export interface ToolCall {
  callID: string;
  toolName: string;
  skillName?: string;
  version?: string;
  definitionHash?: string;
  startTime: number;
  endTime?: number;
  status?: 'success' | 'error';
}

export type EdgeMap = Map<string, string>;

export interface DefinitionPayload {
  hash: string;
  name: string;
  type: 'skill' | 'agent';
  content: string;
  version?: string;
  path: string;
}
