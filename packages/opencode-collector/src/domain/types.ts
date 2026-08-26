export interface ExecutionContext {
  sessionId: string;
  traceId: string;
  parentId?: string;
  agentName?: string;
}

export interface ToolCall {
  callID: string;
  toolName: string;
  startTime: number;
  endTime?: number;
  status?: 'success' | 'error';
}

export type EdgeMap = Map<string, string>;
