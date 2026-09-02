import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

import type { UserRepository } from '@agent-analytics/database';

declare global {
  namespace Express {
    interface Request {
      user?: { id: string; name: string };
    }
  }
}

export function anyAuth(userRepository: UserRepository, jwtSecret: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const authHeader = req.headers.authorization;
    const apiKey = req.headers['x-api-key'];

    // Try JWT first
    if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
      const token = authHeader.slice(7);
      if (token) {
        try {
          const payload = jwt.verify(token, jwtSecret) as { id: string; name: string };
          req.user = { id: payload.id, name: payload.name };
          next();
          return;
        } catch {
          // JWT invalid — fall through to API key
        }
      }
    }

    // Try API key
    if (typeof apiKey === 'string' && apiKey.length > 0) {
      userRepository
        .hashApiKey(apiKey)
        .then((hash) => userRepository.findByApiKeyHash(hash))
        .then((user) => {
          if (user) {
            req.user = { id: user.id, name: user.name };
            next();
          } else {
            res.status(401).json({ error: 'Invalid credentials', code: 'INVALID_CREDENTIALS' });
          }
        })
        .catch(() => {
          res.status(401).json({ error: 'Invalid credentials', code: 'INVALID_CREDENTIALS' });
        });
      return;
    }

    // Neither provided
    res.status(401).json({ error: 'Authentication required', code: 'AUTH_REQUIRED' });
  };
}

export function apiKeyAuth(userRepository: UserRepository) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const apiKey = req.headers['x-api-key'];
    if (typeof apiKey !== 'string' || apiKey.length === 0) {
      res.status(401).json({ error: 'Invalid or missing API key', code: 'INVALID_API_KEY' });
      return;
    }

    try {
      const hash = await userRepository.hashApiKey(apiKey);
      const user = await userRepository.findByApiKeyHash(hash);
      if (!user) {
        res.status(401).json({ error: 'Invalid or missing API key', code: 'INVALID_API_KEY' });
        return;
      }
      req.user = { id: user.id, name: user.name };
      next();
    } catch {
      res.status(401).json({ error: 'Invalid or missing API key', code: 'INVALID_API_KEY' });
    }
  };
}

export function jwtAuth(secret: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Invalid or expired token', code: 'INVALID_TOKEN' });
      return;
    }

    const token = authHeader.slice(7);
    if (!token) {
      res.status(401).json({ error: 'Invalid or expired token', code: 'INVALID_TOKEN' });
      return;
    }

    try {
      const payload = jwt.verify(token, secret) as { id: string; name: string };
      req.user = { id: payload.id, name: payload.name };
      next();
    } catch {
      res.status(401).json({ error: 'Invalid or expired token', code: 'INVALID_TOKEN' });
    }
  };
}
