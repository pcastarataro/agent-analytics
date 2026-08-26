export interface BoundaryDeps {
  log: (entry: { service: string; level: string; message: string }) => void;
}

export function withBoundary<T extends (...args: unknown[]) => void>(fn: T, deps: BoundaryDeps): T {
  let errorCount = 0;
  return ((...args: unknown[]) => {
    try {
      fn(...args);
    } catch (err) {
      errorCount++;
      if (errorCount <= 3) {
        deps.log({
          service: 'opencode-collector',
          level: 'error',
          message: `Hook error #${errorCount}: ${err instanceof Error ? err.message : String(err)}`,
        });
      }
    }
  }) as T;
}
