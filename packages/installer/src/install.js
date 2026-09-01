#!/usr/bin/env node

/**
 * Agent Analytics Plugin Installer
 *
 * Installs the analytics plugin globally into OpenCode's config directory.
 *
 * Usage:
 *   npx @agent-analytics/installer [options]
 *
 * Options:
 *   --url <url>    API endpoint URL (default: http://localhost:3000)
 *   --user <id>    User ID for analytics tracking (default: anonymous)
 *   --api-key <k>  API key for authentication (optional)
 *   --help, -h     Show this help message
 *
 * Installs to ~/.config/opencode/plugins/analytics.mjs
 * Creates ~/.config/opencode/analytics.json
 */

import { existsSync, mkdirSync, writeFileSync, readFileSync, cpSync, chmodSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Colors (no dependency needed)
const green = (s) => `\x1b[32m${s}\x1b[0m`;
const yellow = (s) => `\x1b[33m${s}\x1b[0m`;
const cyan = (s) => `\x1b[36m${s}\x1b[0m`;
const bold = (s) => `\x1b[1m${s}\x1b[0m`;
const dim = (s) => `\x1b[2m${s}\x1b[0m`;

function parseArgs(argv) {
  const args = argv.slice(2);
  const parsed = { url: 'http://localhost:3000', userId: 'anonymous', apiKey: null };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    } else if (arg === '--url' && args[i + 1]) {
      parsed.url = args[++i];
    } else if (arg === '--user' && args[i + 1]) {
      parsed.userId = args[++i];
    } else if (arg === '--api-key' && args[i + 1]) {
      parsed.apiKey = args[++i];
    }
  }

  return parsed;
}

function printHelp() {
  console.log(bold('\n🔧 Agent Analytics Plugin Installer\n'));
  console.log('Usage:');
  console.log(`  ${cyan('npx @agent-analytics/installer')} ${dim('[options]')}\n`);
  console.log('Options:');
  console.log(`  ${cyan('--url <url>')}      API endpoint URL (default: http://localhost:3000)`);
  console.log(`  ${cyan('--user <id>')}      User ID for analytics tracking (default: anonymous)`);
  console.log(`  ${cyan('--api-key <key>')}  API key for authentication (optional)`);
  console.log(`  ${cyan('--help, -h')}       Show this help message\n`);
  console.log('Examples:');
  console.log(`  ${cyan('npx @agent-analytics/installer')}`);
  console.log(`  ${cyan('npx @agent-analytics/installer --url https://api.example.com --user john')}`);
  console.log(`  ${cyan('npx @agent-analytics/installer --user pablo --api-key abc123')}\n`);
}

function main() {
  const config = parseArgs(process.argv);

  console.log(bold('\n🔧 Agent Analytics Plugin Installer\n'));

  // Global OpenCode config directory
  const openCodeDir = join(homedir(), '.config', 'opencode');
  const pluginsDir = join(openCodeDir, 'plugins');
  const pluginFile = join(pluginsDir, 'analytics.mjs');
  const configFile = join(openCodeDir, 'analytics.json');

  console.log(`Installing to: ${cyan(openCodeDir)}\n`);

  // Ensure ~/.config/opencode/plugins exists
  if (!existsSync(pluginsDir)) {
    mkdirSync(pluginsDir, { recursive: true });
    console.log(green('✓ Created ~/.config/opencode/plugins/'));
  }

  // Copy the pre-built bundle from the installer package
  const pluginSource = join(__dirname, '..', 'dist', 'plugin.mjs');

  if (!existsSync(pluginSource)) {
    console.log(yellow('⚠ Plugin bundle not found at: ' + pluginSource));
    console.log(yellow('  Run "pnpm run build" in the installer package first.'));
    process.exit(1);
  }

  try {
    cpSync(pluginSource, pluginFile);
    console.log(green('✓ Installed analytics plugin → ~/.config/opencode/plugins/analytics.mjs'));
  } catch (err) {
    console.error(yellow('✗ Failed to copy plugin: ' + err.message));
    process.exit(1);
  }

  // Make plugin readable (some OpenCode versions may need this)
  try {
    chmodSync(pluginFile, 0o644);
  } catch {
    // Ignore chmod errors on Windows
  }

  // Create or update analytics.json
  if (existsSync(configFile)) {
    // Update existing config with provided values
    try {
      const existing = JSON.parse(readFileSync(configFile, 'utf-8'));
      const collector = existing.collector || {};
      if (config.url) collector.url = config.url;
      if (config.userId) collector.userId = config.userId;
      if (config.apiKey) collector.apiKey = config.apiKey;
      existing.collector = collector;
      writeFileSync(configFile, JSON.stringify(existing, null, 2) + '\n');
      console.log(green('✓ Updated ~/.config/opencode/analytics.json'));
    } catch {
      console.log(yellow('⚠ Could not update config — edit ~/.config/opencode/analytics.json manually'));
    }
  } else {
    const cfg = { collector: { url: config.url, userId: config.userId } };
    if (config.apiKey) cfg.collector.apiKey = config.apiKey;
    writeFileSync(configFile, JSON.stringify(cfg, null, 2) + '\n');
    console.log(green('✓ Created ~/.config/opencode/analytics.json'));
  }

  // Print summary
  console.log(bold('\n─── Setup Complete ───\n'));
  console.log(`  ${dim('URL:')}   ${cyan(config.url)}`);
  console.log(`  ${dim('User:')}  ${cyan(config.userId)}`);
  if (config.apiKey) console.log(`  ${dim('Key:')}   ${cyan('••••' + config.apiKey.slice(-4))}`);
  console.log(`\n  Restart OpenCode to start collecting events.\n`);
}

main();
