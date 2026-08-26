import type { EventStatus } from './schemas';

// Structural token shape defined in-package: collectors pass plain objects, so
// normalize.ts must not import any SDK (pure-domain constraint).
export interface OpenCodeTokensShape {
  input?: number;
  output?: number;
  cached?: number;
}

export interface TokenMetrics {
  inputTokens?: number;
  outputTokens?: number;
  cachedTokens?: number;
}

/** No error → success; MessageAbortedError → cancelled; any other error → error. */
export function resolveStatus(error?: { name?: string } | null): EventStatus {
  if (error == null) {
    return 'success';
  }
  return error.name === 'MessageAbortedError' ? 'cancelled' : 'error';
}

/** First defined candidate wins; none defined → literal 'unknown'. */
export function resolveDefinitionVersion(...candidates: (string | undefined | null)[]): string {
  for (const candidate of candidates) {
    if (candidate !== undefined && candidate !== null) {
      return candidate;
    }
  }
  return 'unknown';
}

/** Sentinel hash input for built-in agents/skills without a definition file. Never empty. */
export function builtinDefinitionHash(name: string): `builtin:${string}` {
  return `builtin:${name}`;
}

/** Maps upstream token counters onto canonical metric names, omitting absent fields. */
export function extractTokenMetrics(tokens?: OpenCodeTokensShape): TokenMetrics {
  if (tokens === undefined) {
    return {};
  }
  const metrics: TokenMetrics = {};
  if (tokens.input !== undefined) {
    metrics.inputTokens = tokens.input;
  }
  if (tokens.output !== undefined) {
    metrics.outputTokens = tokens.output;
  }
  if (tokens.cached !== undefined) {
    metrics.cachedTokens = tokens.cached;
  }
  return metrics;
}
