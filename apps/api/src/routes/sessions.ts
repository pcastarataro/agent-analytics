import { Router } from 'express';

import type { EventRepository } from '@agent-analytics/database';

export function createSessionRoutes(repository: EventRepository): Router {
  const router = Router();

  router.get('/', (req, res, next) => {
    void (async () => {
      try {
        const { limit, cursor, agentName } = req.query as Record<string, string | undefined>;

        const pagination = {
          limit: limit !== undefined ? Math.min(Math.max(parseInt(limit, 10), 1), 100) : 20,
          cursor,
        };

        const result = await repository.findSessionList(pagination, agentName);
        res.json(result);
      } catch (err) {
        next(err);
      }
    })();
  });

  router.get('/:traceId', (req, res, next) => {
    void (async () => {
      try {
        const { traceId } = req.params;
        const detail = await repository.findSessionEvents(traceId);

        if (!detail) {
          res.status(404).json({ status: 404, message: 'Session not found' });
          return;
        }

        res.json({ data: detail });
      } catch (err) {
        next(err);
      }
    })();
  });

  return router;
}
