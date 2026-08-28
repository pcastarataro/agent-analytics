/**
 * OpenCode plugin adapter for @agent-analytics/opencode-collector.
 *
 * Bridges the collector's internal hook-based API to the current OpenCode Plugin interface:
 * - Uses `event` hook for session.created, session.idle, and assistant message.updated
 * - Uses `chat.message` hook for user messages (more reliable than event hook)
 * - Uses `tool.execute.before` / `tool.execute.after` for tool hooks
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

  const collectorSessionCreated = hooks['session.created'] as
    ((input: unknown) => void) | undefined;
  const collectorMessageUpdated = hooks['message.updated'] as
    ((input: unknown) => void) | undefined;
  const collectorToolBefore = hooks['tool.execute.before'] as
    ((input: unknown) => void) | undefined;
  const collectorToolAfter = hooks['tool.execute.after'] as ((input: unknown) => void) | undefined;
  const collectorSessionIdle = hooks['session.idle'] as
    ((input: unknown) => Promise<void>) | undefined;

  return {
    async event({ event }: { event: { type: string; properties: Record<string, unknown> } }) {
      const type = event.type;

      if (type === 'session.created') {
        collectorSessionCreated?.({ session: event.properties.info });
      } else if (type === 'message.updated') {
        const info = event.properties.info as Record<string, unknown>;
        if (info.role === 'assistant') {
          collectorMessageUpdated?.({
            type: 'assistant',
            sessionID: info.sessionID,
            message: info,
          });
        }
      } else if (type === 'session.idle') {
        await collectorSessionIdle?.({ sessionID: event.properties.sessionID });
      }
    },

    async 'chat.message'(
      input: { sessionID: string; agent?: string; model?: { providerID: string; modelID: string } },
      output: { message: { text: string; [key: string]: unknown }; parts: unknown[] },
    ) {
      collectorMessageUpdated?.({
        type: 'user',
        sessionID: input.sessionID,
        agent: input.agent,
        message: { text: output.message.text },
      });
    },

    async 'tool.execute.before'(
      input: { tool: string; sessionID: string; callID: string },
      output: { args: unknown },
    ) {
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
