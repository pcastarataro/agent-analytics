import { Router } from 'express';
import jwt from 'jsonwebtoken';

import type { UserRepository } from '@agent-analytics/database';

export function createAuthRoutes(userRepository: UserRepository, jwtSecret: string): Router {
  const router = Router();

  router.post('/login', (req, res, next) => {
    void (async () => {
      try {
        const { name, password } = req.body as Record<string, unknown>;

        if (typeof name !== 'string' || typeof password !== 'string') {
          res.status(400).json({ error: 'Validation failed', code: 'VALIDATION_ERROR' });
          return;
        }

        const user = await userRepository.findByName(name);
        if (!user) {
          res.status(401).json({ error: 'Invalid credentials', code: 'INVALID_CREDENTIALS' });
          return;
        }

        const valid = await userRepository.comparePassword(password, user.passwordHash);
        if (!valid) {
          res.status(401).json({ error: 'Invalid credentials', code: 'INVALID_CREDENTIALS' });
          return;
        }

        const token = jwt.sign({ id: user.id, name: user.name }, jwtSecret, { expiresIn: '1h' });
        res.json({ token, user: { id: user.id, name: user.name } });
      } catch (err) {
        next(err);
      }
    })();
  });

  return router;
}
