#!/usr/bin/env node

/**
 * Seed script: creates the initial admin user if the users table is empty.
 *
 * Environment variables:
 *   ADMIN_NAME     — admin username (default: "admin")
 *   ADMIN_PASSWORD — admin password (required)
 *   DATABASE_URL   — PostgreSQL connection string (required)
 *
 * Usage:
 *   ADMIN_NAME=admin ADMIN_PASSWORD=secret DATABASE_URL=postgresql://... node seed.js
 */

import { randomBytes, createHash } from 'node:crypto';
import { hash } from 'bcryptjs';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { count } from 'drizzle-orm';

import { users } from './schema';

const BCRYPT_ROUNDS = 10;

function envOrThrow(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function generateApiKey(): string {
  const random = randomBytes(20).toString('hex');
  return `aa_${random}`;
}

function hashApiKey(apiKey: string): string {
  return createHash('sha256').update(apiKey).digest('hex');
}

async function main() {
  const databaseUrl = envOrThrow('DATABASE_URL');
  const adminName = process.env['ADMIN_NAME'] ?? 'admin';
  const adminPassword = envOrThrow('ADMIN_PASSWORD');

  const client = postgres(databaseUrl);
  const db = drizzle(client);

  // Check if any users exist
  const [result] = await db.select({ value: count() }).from(users);
  const userCount = result?.value ?? 0;

  if (userCount > 0) {
    console.log(`[seed] ${userCount} user(s) already exist — skipping seed.`);
    await client.end();
    return;
  }

  // Create admin user
  const passwordHash = await hash(adminPassword, BCRYPT_ROUNDS);
  const apiKey = generateApiKey();
  const apiKeyHash = hashApiKey(apiKey);

  const [row] = await db
    .insert(users)
    .values({
      name: adminName,
      passwordHash,
      apiKeyHash,
    })
    .returning();

  console.log(`[seed] Admin user created:`);
  console.log(`  name:    ${row!.name}`);
  console.log(`  id:      ${row!.id}`);
  console.log(`  api_key: ${apiKey}`);
  console.log(`\n  Save this API key — it won't be shown again.`);

  await client.end();
}

main().catch((err) => {
  console.error('[seed] Failed:', err);
  process.exit(1);
});
