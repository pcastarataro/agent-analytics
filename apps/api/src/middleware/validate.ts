import type { Request, Response, NextFunction } from 'express';
import type { ZodSchema } from 'zod';

export function validateBody(schema: ZodSchema) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const error = new Error('Validation failed') as Error & {
        status: number;
        details: unknown;
      };
      error.status = 400;
      error.details = result.error.issues;
      next(error);
      return;
    }
    req.body = result.data;
    next();
  };
}
