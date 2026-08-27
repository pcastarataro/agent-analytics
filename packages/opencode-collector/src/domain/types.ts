export interface ExecutionContext {
  sessionId: string;
  traceId: string;
  parentId?: string;
  agentName?: string;
  eventType?: 'session_created' | 'user_message' | 'assistant_message' | 'tool_call' | 'skill_call';
}

export interface ToolCall {
  callID: string;
  toolName: string;
  skillName?: string;
  startTime: number;
  endTime?: number;
  status?: 'success' | 'error';
}

export type EdgeMap = Map<string, string>;
