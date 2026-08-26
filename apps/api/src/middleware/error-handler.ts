import type { Request, Response, NextFunction } from 'express';
import type { ApiError } from '@agent-analytics/shared';

export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction): void {
  const apiError = err as unknown as ApiError;

  const status = typeof apiError.status === 'number' ? apiError.status : 500;
  const message = status === 500 ? 'Internal server error' : apiError.message;

  if (status === 500) {
    console.error('[error-handler]', err);
  }

  res.status(status).json({ status, message, details: apiError.details });
}
