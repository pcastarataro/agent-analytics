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

        const aggregation = await repository.getMetricsAggregation(filters);

        res.json(aggregation);
      } catch (err) {
        next(err);
      }
    })();
  });

  router.get('/agents', (req, res, next) => {
    void (async () => {
      try {
        const { from, to } = req.query as Record<string, string | undefined>;

        const dateFilters: DateFilters = {};
        if (from !== undefined) dateFilters.from = new Date(from);
        if (to !== undefined) dateFilters.to = new Date(to);

        const hasFilters = Object.keys(dateFilters).length > 0;
        const filters = hasFilters ? dateFilters : undefined;

        const data = await repository.getAgentStats(filters);

        res.json({ data });
      } catch (err) {
        next(err);
      }
    })();
  });

  router.get('/skills', (req, res, next) => {
    void (async () => {
      try {
        const { from, to } = req.query as Record<string, string | undefined>;

        const dateFilters: DateFilters = {};
        if (from !== undefined) dateFilters.from = new Date(from);
        if (to !== undefined) dateFilters.to = new Date(to);

        const hasFilters = Object.keys(dateFilters).length > 0;
        const filters = hasFilters ? dateFilters : undefined;

        const data = await repository.getSkillStats(filters);

        res.json({ data });
      } catch (err) {
        next(err);
      }
    })();
  });

  router.get('/skills/versions', (req, res, next) => {
    void (async () => {
      try {
        const { from, to } = req.query as Record<string, string | undefined>;

        const dateFilters: DateFilters = {};
        if (from !== undefined) dateFilters.from = new Date(from);
        if (to !== undefined) dateFilters.to = new Date(to);

        const hasFilters = Object.keys(dateFilters).length > 0;
        const filters = hasFilters ? dateFilters : undefined;

        const data = await repository.getSkillVersions(filters);

        res.json({ data });
      } catch (err) {
        next(err);
      }
    })();
  });

  router.get('/users', (req, res, next) => {
    void (async () => {
      try {
        const { from, to } = req.query as Record<string, string | undefined>;

        const dateFilters: DateFilters = {};
        if (from !== undefined) dateFilters.from = new Date(from);
        if (to !== undefined) dateFilters.to = new Date(to);

        const hasFilters = Object.keys(dateFilters).length > 0;
        const filters = hasFilters ? dateFilters : undefined;

        const data = await repository.getUserStats(filters);

        res.json({ data });
      } catch (err) {
        next(err);
      }
    })();
  });

  router.get('/agents/:name', (req, res, next) => {
    void (async () => {
      try {
        const { name } = req.params;
        const detail = await repository.getAgentDetail(name);
        if (!detail) {
          res.status(404).json({ error: 'Agent not found' });
          return;
        }
        res.json(detail);
      } catch (err) {
        next(err);
      }
    })();
  });

  router.get('/skills/:skillName', (req, res, next) => {
    void (async () => {
      try {
        const { skillName } = req.params;
        const detail = await repository.getSkillDetail(skillName);
        if (!detail) {
          res.status(404).json({ error: 'Skill not found' });
          return;
        }
        res.json(detail);
      } catch (err) {
        next(err);
      }
    })();
  });

  router.get('/users/:userId', (req, res, next) => {
    void (async () => {
      try {
        const { userId } = req.params;
        const detail = await repository.getUserDetail(userId);
        if (!detail) {
          res.status(404).json({ error: 'User not found' });
          return;
        }
        res.json(detail);
      } catch (err) {
        next(err);
      }
    })();
  });

  return router;
}
