import { Router } from 'express';

import type { UserRepository } from '@agent-analytics/database';

export function createUserRoutes(userRepository: UserRepository): Router {
  const router = Router();

  // GET /v1/users — list all users (exclude sensitive fields)
  router.get('/', (_req, res, next) => {
    void (async () => {
      try {
        const users = await userRepository.list();
        const sanitized = users.map(({ passwordHash: _, apiKeyHash: __, ...rest }) => ({
          id: rest.id,
          name: rest.name,
          createdAt: rest.createdAt,
          updatedAt: rest.updatedAt,
        }));
        res.json(sanitized);
      } catch (err) {
        next(err);
      }
    })();
  });

  // POST /v1/users — create user, return api_key ONCE
  router.post('/', (req, res, next) => {
    void (async () => {
      try {
        const { name, password } = req.body as Record<string, unknown>;

        if (typeof name !== 'string' || typeof password !== 'string') {
          res.status(400).json({ error: 'Validation failed', code: 'VALIDATION_ERROR' });
          return;
        }

        const existing = await userRepository.findByName(name);
        if (existing) {
          res.status(409).json({ error: 'User already exists', code: 'USER_EXISTS' });
          return;
        }

        const bcrypt = await import('bcryptjs');
        const passwordHash = await bcrypt.hash(password, 10);
        const result = await userRepository.create(name, passwordHash);

        res.status(201).json({
          id: result.id,
          name: result.name,
          api_key: result.apiKey,
          createdAt: result.createdAt,
        });
      } catch (err) {
        next(err);
      }
    })();
  });

  // DELETE /v1/users/:id — delete user and cascade events
  router.delete('/:id', (req, res, next) => {
    void (async () => {
      try {
        const { id } = req.params;
        const user = await userRepository.findById(id);
        if (!user) {
          res.status(404).json({ error: 'User not found', code: 'USER_NOT_FOUND' });
          return;
        }
        await userRepository.delete(id);
        res.status(204).end();
      } catch (err) {
        next(err);
      }
    })();
  });

  // POST /v1/users/:id/key/revoke — revoke API key
  router.post('/:id/key/revoke', (req, res, next) => {
    void (async () => {
      try {
        const { id } = req.params;
        const user = await userRepository.findById(id);
        if (!user) {
          res.status(404).json({ error: 'User not found', code: 'USER_NOT_FOUND' });
          return;
        }
        await userRepository.revokeKey(id);
        res.json({ success: true });
      } catch (err) {
        next(err);
      }
    })();
  });

  // POST /v1/users/:id/key/regenerate — regenerate API key
  router.post('/:id/key/regenerate', (req, res, next) => {
    void (async () => {
      try {
        const { id } = req.params;
        const user = await userRepository.findById(id);
        if (!user) {
          res.status(404).json({ error: 'User not found', code: 'USER_NOT_FOUND' });
          return;
        }
        const { apiKey } = await userRepository.regenerateKey(id);
        res.json({ api_key: apiKey });
      } catch (err) {
        next(err);
      }
    })();
  });

  return router;
}
