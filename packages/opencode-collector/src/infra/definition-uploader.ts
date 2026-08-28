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

export interface DefinitionIndex {
  path: string;
  type: 'skill' | 'agent';
}

export interface DefinitionUploader {
  buildIndex(dirs: string[]): Promise<number>;
  scanDefinitions(dirs: string[]): Promise<void>;
  ensureDefinition(hash: string, name?: string): Promise<void>;
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
  const definitionIndex = new Map<string, DefinitionIndex>();

  async function buildIndex(dirs: string[]): Promise<number> {
    async function walkDir(dir: string): Promise<void> {
      let entries: string[];
      try {
        entries = readdir(dir);
      } catch {
        return;
      }
      for (const entry of entries) {
        const fullPath = join(dir, entry);
        try {
          readFile(fullPath);
          // It's a file — index it
          const name = inferName(fullPath);
          definitionIndex.set(name, { path: fullPath, type: inferType(fullPath) });
        } catch {
          // It's a directory — recurse
          await walkDir(fullPath);
        }
      }
    }

    for (const dir of dirs) {
      await walkDir(dir);
    }
    return definitionIndex.size;
  }

  async function scanFile(filePath: string): Promise<void> {
    let content: string;
    try {
      content = readFile(filePath);
    } catch {
      // Might be a directory — try recursing into it
      let children: string[];
      try {
        children = readdir(filePath);
      } catch {
        log({
          service: 'opencode-collector',
          level: 'warn',
          message: `Failed to read definition file, skipping: ${filePath}`,
        });
        return;
      }

      for (const child of children) {
        await scanFile(join(filePath, child));
      }
      return;
    }

    if (content.length > MAX_FILE_SIZE) {
      log({
        service: 'opencode-collector',
        level: 'warn',
        message: `Definition file exceeds 1MB limit, skipping: ${filePath}`,
      });
      return;
    }

    const hash = computeHash(content);

    if (uploadedHashes.has(hash)) return;

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

  async function scanDefinitions(dirs: string[]): Promise<void> {
    for (const dir of dirs) {
      let entries: string[];
      try {
        entries = readdir(dir);
      } catch {
        log({
          service: 'opencode-collector',
          level: 'debug',
          message: `Definition directory not found, skipping: ${dir}`,
        });
        continue;
      }

      for (const entry of entries) {
        await scanFile(join(dir, entry));
      }
    }
  }

  async function ensureDefinition(hash: string, name?: string): Promise<void> {
    if (uploadedHashes.has(hash)) return;

    if (!name || !definitionIndex.has(name)) {
      uploadedHashes.add(hash);
      if (name) {
        log({
          service: 'opencode-collector',
          level: 'warn',
          message: `Definition not found in index: ${name}`,
        });
      }
      return;
    }

    const entry = definitionIndex.get(name)!;
    let content: string;
    try {
      content = readFile(entry.path);
    } catch {
      uploadedHashes.add(hash);
      log({
        service: 'opencode-collector',
        level: 'warn',
        message: `Definition file not found: ${entry.path}`,
      });
      return;
    }

    const payload: DefinitionPayload = {
      hash,
      name,
      type: entry.type,
      content,
      path: entry.path,
    };

    try {
      await putDefinition(payload);
      uploadedHashes.add(hash);
    } catch {
      // Hash NOT cached — allows retry on next event
      log({
        service: 'opencode-collector',
        level: 'error',
        message: `Failed to upload definition: ${entry.path}`,
      });
    }
  }

  return { buildIndex, scanDefinitions, ensureDefinition, uploadedHashes };
}
