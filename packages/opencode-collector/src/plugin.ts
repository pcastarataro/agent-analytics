/**
 * OpenCode plugin adapter for @agent-analytics/opencode-collector.
 *
 * Bridges the collector's internal hook-based API to the current OpenCode Plugin interface:
 * - Uses `event` hook for session.created, session.updated, session.idle, message.updated
 * - Uses `chat.message` hook for user messages
 * - Uses `chat.params` hook to capture agent name (required field, most reliable source)
 * - Uses `tool.execute.before` / `tool.execute.after` for tool hooks
 *
 * KEY FIX: Captures assistant cost/tokens from `session.updated` events
 * because `message.updated` may not fire in all OpenCode versions.
 * The `Session` object in `session.updated` carries accumulated cost and tokens.
 */
import { createPlugin as createCollectorHooks } from '@agent-analytics/opencode-collector';

interface PluginInput {
  client: {
    app: {
      log: (entry: {
        body: { service: string; level: string; message: string; hooks?: string[] };
      }) => Promise<void>;
    };
    session: { messages: (args: { id: string }) => Promise<unknown[]> };
  };
  project: unknown;
  $: unknown;
  directory: string;
  worktree: string;
}

export const AgentAnalyticsPlugin = async (input: PluginInput) => {
  const hooks = await createCollectorHooks({
    client: input.client,
    project: input.project,
    $: input.$,
    directory: input.directory,
    worktree: input.worktree,
  });

  const collectorSessionCreated = hooks['session.created'] as ((input: unknown) => void) | undefined;
  const collectorMessageUpdated = hooks['message.updated'] as ((input: unknown) => void) | undefined;
  const collectorToolBefore = hooks['tool.execute.before'] as ((input: unknown) => void) | undefined;
  const collectorToolAfter = hooks['tool.execute.after'] as ((input: unknown) => void) | undefined;
  const collectorSessionIdle = hooks['session.idle'] as ((input: unknown) => Promise<void>) | undefined;

  const log = (level: string, message: string) => {
    input.client.app.log({
      body: { service: 'analytics-plugin', level, message },
    }).catch(() => {});
  };

  // Track agent name per session
  const sessionAgents = new Map<string, string>();
  const knownSessions = new Set<string>();

  // Track last known cost per session to detect changes
  const lastKnownCost = new Map<string, number>();

  function setAgent(sessionID: string | undefined, agent: string | undefined) {
    if (sessionID && agent) {
      sessionAgents.set(sessionID, agent);
    }
  }

  function getAgent(sessionID: string | undefined): string | undefined {
    return sessionID ? sessionAgents.get(sessionID) : undefined;
  }

  /** Ensure collector has an execution context for this session */
  function ensureSession(sessionID: string | undefined) {
    if (!sessionID || knownSessions.has(sessionID)) return;
    knownSessions.add(sessionID);
    collectorSessionCreated?.({ session: { id: sessionID } });
    log('info', `ensureSession: created context for ${sessionID}`);
  }

  /**
   * Emit an assistant_message event with cost data from Session object.
   * Called when session.updated shows new cost that wasn't reported via message.updated.
   */
  function emitCostEvent(sessionID: string, cost: number, tokens: Record<string, number> | undefined) {
    ensureSession(sessionID);

    collectorMessageUpdated?.({
      type: 'assistant',
      sessionID,
      message: {
        cost,
        tokens: tokens ? {
          input: tokens.input ?? 0,
          output: tokens.output ?? 0,
          reasoning: tokens.reasoning ?? 0,
          cache: { read: tokens['cache.read'] ?? 0, write: tokens['cache.write'] ?? 0 },
        } : undefined,
      },
    });
    log('info', `emitCostEvent: session=${sessionID} cost=${cost}`);
  }

  return {
    async event({ event }: { event: { type: string; properties: Record<string, unknown> } }) {
      const type = event.type;

      if (type === 'session.created') {
        const info = event.properties.info as Record<string, unknown>;
        const sessionID = info?.id as string | undefined;
        if (sessionID) {
          knownSessions.add(sessionID);
          lastKnownCost.set(sessionID, 0);
        }
        collectorSessionCreated?.({ session: event.properties.info });
        log('info', `event: session.created id=${sessionID}`);
      } else if (type === 'session.updated') {
        // KEY FIX: session.updated carries the full Session object with cost and tokens
        const info = event.properties.info as Record<string, unknown> | undefined;
        const sessionID = (info?.id ?? event.properties.sessionID) as string | undefined;
        if (!sessionID || !info) return;

        ensureSession(sessionID);

        const cost = (info.cost as number) ?? 0;
        const tokens = info.tokens as Record<string, number> | undefined;
        const prevCost = lastKnownCost.get(sessionID) ?? 0;

        // Capture agent from session if present
        if (info.agent && typeof info.agent === 'string') {
          setAgent(sessionID, info.agent);
        }

        // Only emit cost event if cost actually changed
        if (cost > prevCost) {
          lastKnownCost.set(sessionID, cost);
          emitCostEvent(sessionID, cost, tokens);
        }
      } else if (type === 'message.updated') {
        const info = event.properties.info as Record<string, unknown>;
        const sessionID = (info?.sessionID ?? event.properties.sessionID) as string | undefined;

        ensureSession(sessionID);

        // Capture agent from message if present
        if (info.role === 'user' && info.agent) {
          setAgent(sessionID, info.agent as string);
        }

        if (info.role === 'assistant') {
          collectorMessageUpdated?.({
            type: 'assistant',
            sessionID,
            message: info,
          });
          log('info', `event: message.updated assistant session=${sessionID}`);
        } else if (info.role === 'user') {
          const agentName = (info.agent as string) ?? getAgent(sessionID);
          collectorMessageUpdated?.({
            type: 'user',
            sessionID,
            agent: agentName,
            message: { text: '' },
          });
          log('info', `event: message.updated user session=${sessionID}`);
        }
      } else if (type === 'session.idle') {
        const sessionID = event.properties.sessionID as string | undefined;
        await collectorSessionIdle?.({ sessionID });
        log('info', `event: session.idle session=${sessionID}`);
        // Clean up tracking data
        if (sessionID) {
          lastKnownCost.delete(sessionID);
          sessionAgents.delete(sessionID);
        }
      }
    },

    async 'chat.message'(
      input: { sessionID: string; agent?: string; model?: { providerID: string; modelID: string } },
      output: { message: { text: string; agent?: string; [key: string]: unknown }; parts: unknown[] },
    ) {
      ensureSession(input.sessionID);

      const agentName = output.message.agent ?? input.agent ?? getAgent(input.sessionID);
      setAgent(input.sessionID, agentName);

      collectorMessageUpdated?.({
        type: 'user',
        sessionID: input.sessionID,
        agent: agentName,
        message: { text: output.message.text },
      });
      log('info', `chat.message: user session=${input.sessionID} agent=${agentName}`);
    },

    async 'chat.params'(
      input: { sessionID: string; agent: string; [key: string]: unknown },
      output: Record<string, unknown>,
    ) {
      ensureSession(input.sessionID);
      setAgent(input.sessionID, input.agent);
    },

    async 'tool.execute.before'(
      input: { tool: string; sessionID: string; callID: string },
      output: { args: unknown },
    ) {
      ensureSession(input.sessionID);

      collectorToolBefore?.({
        input: {
          callID: input.callID,
          tool: input.tool,
          args: output.args as Record<string, unknown> | undefined,
          sessionID: input.sessionID,
        },
      });
    },

    async 'tool.execute.after'(
      input: { tool: string; sessionID: string; callID: string; args: unknown },
      output: { title: string; output: string; metadata: Record<string, unknown> },
    ) {
      const hasError = output.metadata?.error === true || output.metadata?.isError === true;
      collectorToolAfter?.({
        input: {
          callID: input.callID,
          sessionID: input.sessionID,
        },
        result: { error: hasError },
      });
    },

    dispose: hooks.dispose,
  };
};
