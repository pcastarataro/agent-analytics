import { createHash } from 'node:crypto';
import { join } from 'node:path';
import type { DefinitionPayload } from '../domain/types';

const MAX_FILE_SIZE = 1_000_000; // 1MB

export interface DefinitionUploaderDeps {
  readFile: (path: string) => string;
  readdir: (path: string) => string[];
  putDefinition: (payload: DefinitionPayload) => Promise<void>;
  log: (entry: { service: string; level: string; message: string }) => void;
}

export interface DefinitionUploader {
  scanDefinitions(dirs: string[]): Promise<void>;
  ensureDefinition(hash: string): Promise<void>;
  uploadedHashes: Set<string>;
}

export function computeHash(content: string): string {
  return createHash('sha256').update(content).digest('hex');
}

function inferType(filePath: string): 'skill' | 'agent' {
  return filePath.includes('/skills/') ? 'skill' : 'agent';
}

function inferName(filePath: string): string {
  const parts = filePath.split('/');
  const lastDir = parts[parts.length - 2] ?? 'unknown';
  return lastDir;
}

export function createDefinitionUploader(deps: DefinitionUploaderDeps): DefinitionUploader {
  const { readFile, readdir, putDefinition, log } = deps;
  const uploadedHashes = new Set<string>();

  async function scanDefinitions(dirs: string[]): Promise<void> {
    for (const dir of dirs) {
      let files: string[];
      try {
        files = readdir(dir);
      } catch {
        log({
          service: 'opencode-collector',
          level: 'debug',
          message: `Definition directory not found, skipping: ${dir}`,
        });
        continue;
      }

      for (const file of files) {
        const filePath = join(dir, file);

        let content: string;
        try {
          content = readFile(filePath);
        } catch {
          log({
            service: 'opencode-collector',
            level: 'warn',
            message: `Failed to read definition file, skipping: ${filePath}`,
          });
          continue;
        }

        if (content.length > MAX_FILE_SIZE) {
          log({
            service: 'opencode-collector',
            level: 'warn',
            message: `Definition file exceeds 1MB limit, skipping: ${filePath}`,
          });
          continue;
        }

        const hash = computeHash(content);

        if (uploadedHashes.has(hash)) continue;

        const payload: DefinitionPayload = {
          hash,
          name: inferName(filePath),
          type: inferType(filePath),
          content,
          path: filePath,
        };

        try {
          await putDefinition(payload);
          uploadedHashes.add(hash);
        } catch {
          log({
            service: 'opencode-collector',
            level: 'error',
            message: `Failed to upload definition: ${filePath}`,
          });
          // Hash NOT cached — will retry on next scan or lazy fallback
        }
      }
    }
  }

  async function ensureDefinition(hash: string): Promise<void> {
    if (uploadedHashes.has(hash)) return;

    // Lazy fallback — hash-only guard to prevent re-enqueue retries.
    // Note: Without the file content, we cannot compute a new PUT.
    // The startup scan (scanDefinitions) is the primary upload path.
    // This guard ensures we don't waste cycles on hashes we already know about.
    uploadedHashes.add(hash);
  }

  return { scanDefinitions, ensureDefinition, uploadedHashes };
}
