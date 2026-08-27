import { z } from 'zod';

import { UuidV7Schema } from './ids';

// Ten group schemas. Nested objects tolerate unrecognized properties (D10) so newer
// collectors can add fields additively without breaking older consumers.
export const actorSchema = z.looseObject({
  userId: z.string(),
});

export const projectSchema = z.looseObject({});

export const sessionSchema = z.looseObject({});

export const executionSchema = z.looseObject({
  traceId: z.string(),
  parentId: z.string().optional(),
});

export const agentSchema = z.looseObject({
  name: z.string(),
  version: z.string().optional(),
  definitionHash: z.string().optional(),
});

export const skillSchema = z.looseObject({
  name: z.string(),
  version: z.string().optional(),
  definitionHash: z.string().optional(),
});

export const toolSchema = z.looseObject({});

export const modelSchema = z.looseObject({});

export const metricsSchema = z.looseObject({
  durationMs: z.number().optional(),
  inputTokens: z.number().optional(),
  outputTokens: z.number().optional(),
  cachedTokens: z.number().optional(),
  cost: z.number().optional(),
  promptLength: z.number().optional(),
  promptHash: z.string().optional(),
});

export const resultSchema = z.looseObject({
  status: z.enum(['success', 'error', 'cancelled']),
});

// Top-level key set is closed and exact (D10): an unknown top-level key is rejected
// and constitutes a breaking change requiring a major version bump.
export const usageEventSchema = z.strictObject({
  id: UuidV7Schema,
  actor: actorSchema,
  project: projectSchema,
  session: sessionSchema,
  execution: executionSchema,
  agent: agentSchema,
  skill: skillSchema,
  tool: toolSchema,
  model: modelSchema,
  metrics: metricsSchema,
  result: resultSchema,
  timestamp: z.string().optional(),
});

export type UsageEvent = z.infer<typeof usageEventSchema>;

export type EventStatus = z.infer<typeof resultSchema>['status'];
