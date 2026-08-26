import type { Request, Response, NextFunction } from 'express';

export function authStub(_req: Request, _res: Response, next: NextFunction): void {
  // Stub: always passes. Real implementation will validate API key.
  next();
}
