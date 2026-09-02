import crypto from 'crypto';

export interface ApiConfig {
  port: number;
  databaseUrl: string;
  corsOrigins: string[];
  jwtSecret: string;
}

function envOrThrow(name: string): string {
  const value = process.env[name];
  if (value === undefined || value.length === 0) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export function loadConfig(overrides?: Partial<ApiConfig>): ApiConfig {
  return {
    port: Number(overrides?.port ?? process.env['PORT'] ?? 3000),
    databaseUrl: overrides?.databaseUrl ?? envOrThrow('DATABASE_URL'),
    corsOrigins: overrides?.corsOrigins ??
      process.env['CORS_ORIGINS']?.split(',').filter(Boolean) ?? ['http://localhost:5173'],
    jwtSecret: overrides?.jwtSecret ?? process.env['JWT_SECRET'] ?? crypto.randomBytes(32).toString('hex'),
  };
}
