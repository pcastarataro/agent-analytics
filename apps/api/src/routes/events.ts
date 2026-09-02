import { Router } from 'express';
import { z } from 'zod';

import type { EventRepository } from '@agent-analytics/database';
import { usageEventSchema } from '@agent-analytics/event-schema';

import type { EventFilters, Pagination } from '@agent-analytics/database';

export function createEventRoutes(repository: EventRepository): Router {
  const router = Router();

  router.post('/batch', (req, res, next) => {
    void (async () => {
      try {
        const rawEvents = req.body as unknown[];
        const validEvents: z.infer<typeof usageEventSchema>[] = [];
        const errors: Array<{ index: number; issues: z.ZodIssue[] }> = [];

        for (let i = 0; i < rawEvents.length; i++) {
          const result = usageEventSchema.safeParse(rawEvents[i]);
          if (result.success) {
            validEvents.push(result.data);
          } else {
            errors.push({ index: i, issues: result.error.issues });
          }
        }

        if (errors.length > 0) {
          console.warn(`[events/batch] Skipped ${errors.length} invalid event(s):`, errors);
        }

        // Inject userId from authenticated API key — server is source of truth
        if (req.user) {
          for (const event of validEvents) {
            if (!event.actor) event.actor = {} as typeof event.actor;
            (event.actor as Record<string, unknown>).userId = req.user.id;
          }
        }

        const accepted = await repository.insertBatch(validEvents);
        res.status(201).json({ accepted });
      } catch (err) {
        next(err);
      }
    })();
  });

  router.get('/', (req, res, next) => {
    void (async () => {
      try {
        const { limit, cursor, agentName, sessionId, status, from, to } = req.query as Record<
          string,
          string | undefined
        >;

        const filters: EventFilters = {};
        if (agentName !== undefined) filters.agentName = agentName;
        if (sessionId !== undefined) filters.sessionId = sessionId;
        if (status !== undefined) filters.status = status;
        if (from !== undefined) filters.from = new Date(from);
        if (to !== undefined) filters.to = new Date(to);

        const pagination: Pagination = {
          limit: limit !== undefined ? Math.min(Math.max(parseInt(limit, 10), 1), 100) : 10,
          cursor,
        };

        const result = await repository.findAll(filters, pagination);
        res.json(result);
      } catch (err) {
        next(err);
      }
    })();
  });

  return router;
}
