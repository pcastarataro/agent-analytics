import { basename } from 'node:path';
import { execFile } from 'node:child_process';

/**
 * Extracts the project name from a directory path using path.basename.
 * Returns "unknown" if the directory is empty or undefined.
 */
export function extractProjectName(directory: string | undefined): string {
  if (!directory) return 'unknown';
  const name = basename(directory);
  return name || 'unknown';
}

const GIT_TIMEOUT_MS = 5_000;

/**
 * Detects the current git branch for the given directory.
 * Returns the branch name on success, "detached" on git failure or timeout,
 * or "unknown" if directory is undefined.
 */
export function detectGitBranch(directory: string | undefined): Promise<string> {
  if (!directory) return Promise.resolve('unknown');

  return new Promise((resolve) => {
    const child = execFile(
      'git',
      ['rev-parse', '--abbrev-ref', 'HEAD'],
      { cwd: directory, timeout: GIT_TIMEOUT_MS },
      (error, stdout) => {
        if (error || !stdout) {
          resolve('detached');
          return;
        }
        const branch = stdout.trim();
        resolve(branch || 'detached');
      },
    );

    // Ensure the child process is killed on timeout
    child.on('error', () => {
      resolve('detached');
    });
  });
}

/**
 * Creates a per-session cache for git branch detection.
 * Multiple events in the same session will share the same branch result.
 */
export function createBranchCache(): Map<string, Promise<string>> {
  return new Map();
}

/**
 * Gets the git branch for a directory, using the cache to avoid redundant calls.
 * The cache key is the directory path.
 */
export function getCachedBranch(
  cache: Map<string, Promise<string>>,
  directory: string | undefined,
): Promise<string> {
  const key = directory ?? '';
  const cached = cache.get(key);
  if (cached) return cached;

  const promise = detectGitBranch(directory);
  cache.set(key, promise);
  return promise;
}
