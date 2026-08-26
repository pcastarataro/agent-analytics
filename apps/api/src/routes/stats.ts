import { Router } from 'express';

import type { EventRepository, DateFilters } from '@agent-analytics/database';

export function createStatsRoutes(repository: EventRepository): Router {
  const router = Router();

  router.get('/overview', (req, res, next) => {
    void (async () => {
      try {
        const { from, to } = req.query as Record<string, string | undefined>;

        const dateFilters: DateFilters = {};
        if (from !== undefined) dateFilters.from = new Date(from);
        if (to !== undefined) dateFilters.to = new Date(to);

        const hasFilters = Object.keys(dateFilters).length > 0;
        const filters = hasFilters ? dateFilters : undefined;

        const [byAgent, byStatus, byDate] = await Promise.all([
          repository.countByGroup('agentName', filters),
          repository.countByGroup('status', filters),
          repository.countByDate(filters),
        ]);

        const total = Object.values(byAgent).reduce((sum, n) => sum + n, 0);

        res.json({ total, byAgent, byStatus, byDate });
      } catch (err) {
        next(err);
      }
    })();
  });

  return router;
}
