#!/usr/bin/env node

/**
 * Agent Analytics Plugin Installer
 *
 * Installs the analytics plugin into an OpenCode project.
 *
 * Usage:
 *   npx @agent-analytics/installer [target-dir]
 *
 * If target-dir is not specified, uses the current working directory.
 */

import { existsSync, mkdirSync, writeFileSync, readFileSync, cpSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Colors (no dependency needed)
const green = (s) => `\x1b[32m${s}\x1b[0m`;
const yellow = (s) => `\x1b[33m${s}\x1b[0m`;
const cyan = (s) => `\x1b[36m${s}\x1b[0m`;
const bold = (s) => `\x1b[1m${s}\x1b[0m`;

function main() {
  const targetDir = process.argv[2] || process.cwd();

  console.log(bold('\n🔧 Agent Analytics Plugin Installer\n'));
  console.log(`Target directory: ${cyan(targetDir)}\n`);

  // Resolve .opencode directory
  const openCodeDir = join(targetDir, '.opencode');
  const pluginsDir = join(openCodeDir, 'plugins');
  const pluginFile = join(pluginsDir, 'analytics.ts');
  const configFile = join(openCodeDir, 'analytics.json');

  // Ensure .opencode/plugins exists
  if (!existsSync(pluginsDir)) {
    mkdirSync(pluginsDir, { recursive: true });
    console.log(green('✓ Created .opencode/plugins/'));
  }

  // Copy plugin file
  const pluginSource = join(__dirname, '..', '..', '.opencode', 'plugins', 'analytics.ts');
  if (existsSync(pluginSource)) {
    cpSync(pluginSource, pluginFile, { recursive: true });
    console.log(green('✓ Installed analytics plugin → .opencode/plugins/analytics.ts'));
  } else {
    // Fallback: write the plugin inline
    writeFileSync(pluginFile, PLUGIN_CONTENT);
    console.log(green('✓ Installed analytics plugin → .opencode/plugins/analytics.ts'));
  }

  // Create or update analytics.json
  if (existsSync(configFile)) {
    console.log(yellow('⚠ .opencode/analytics.json already exists — skipping (edit manually if needed)'));
  } else {
    const config = {
      collector: {
        url: 'http://localhost:3000',
        userId: 'anonymous',
      },
    };
    writeFileSync(configFile, JSON.stringify(config, null, 2) + '\n');
    console.log(green('✓ Created .opencode/analytics.json'));
  }

  // Print instructions
  console.log(bold('\n─── Setup Complete ───\n'));
  console.log('Next steps:\n');
  console.log(`  1. Start the API server:`);
  console.log(`     ${cyan('docker compose up -d')}\n`);
  console.log(`  2. Set your user ID in .opencode/analytics.json:`);
  console.log(`     ${cyan('{ "collector": { "url": "http://localhost:3000", "userId": "your-name" } }')}\n`);
  console.log(`  3. (Optional) Set environment variables:`);
  console.log(`     ${cyan('export OPENCODE_ANALYTICS_URL=http://localhost:3000')}`);
  console.log(`     ${cyan('export OPENCODE_ANALYTICS_USER=your-name')}\n`);
  console.log(`  4. Start using OpenCode — events are collected automatically.\n`);
}

// Fallback plugin content (in case source file isn't found relative to installer)
const PLUGIN_CONTENT = `/**
 * OpenCode plugin adapter for @agent-analytics/opencode-collector.
 *
 * Bridges the collector's internal hook-based API to the current OpenCode Plugin interface:
 * - Uses \`event\` hook for session.created, session.idle, and assistant message.updated
 * - Uses \`chat.message\` hook for user messages (more reliable than event hook)
 * - Uses \`tool.execute.before\` / \`tool.execute.after\` for tool hooks
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
`;

main();
