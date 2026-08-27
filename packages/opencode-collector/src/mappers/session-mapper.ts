import type { ExecutionContext, EdgeMap } from '../domain/types';

export function mapSessionCreated(
  payload: { session: { id: string; parentID?: string } },
  executions: Map<string, ExecutionContext>,
  edges: EdgeMap,
): ExecutionContext {
  const { id, parentID } = payload.session;

  if (parentID) {
    edges.set(id, parentID);
  }

  let rootId = id;
  let current: string | undefined = parentID;
  while (current !== undefined) {
    rootId = current;
    current = edges.get(current);
  }

  const ctx: ExecutionContext = {
    sessionId: id,
    traceId: rootId,
    parentId: parentID,
    eventType: 'session_created',
  };

  executions.set(id, ctx);
  return ctx;
}
