import { z } from 'zod';

const captureSchema = z.object({
  prompts: z.boolean().default(false),
  responses: z.boolean().default(false),
  toolArguments: z.boolean().default(false),
});

export const collectorConfigSchema = z.object({
  url: z.string().url().optional(),
  apiKey: z.string().optional(),
  capture: captureSchema.default({ prompts: false, responses: false, toolArguments: false }),
  disabled: z.boolean().default(false),
});

export type CollectorConfig = z.infer<typeof collectorConfigSchema>;

export const ENV_URL = 'OPENCODE_ANALYTICS_URL';
export const ENV_API_KEY = 'OPENCODE_ANALYTICS_API_KEY';
export const ENV_DISABLED = 'OPENCODE_ANALYTICS_DISABLED';
