import { Router } from 'express';
import { z } from 'zod';

import type { EventRepository } from '@agent-analytics/database';

const DefinitionBodySchema = z.object({
  content: z.string().min(1).max(65536),
  entityType: z.enum(['agent', 'skill']),
  entityName: z.string().min(1),
  version: z.string().nullable().optional(),
});

export function createDefinitionRoutes(repository: EventRepository): Router {
  const router = Router();

  router.get('/', (req, res, next) => {
    void (async () => {
      try {
        const { entityType, entityName } = req.query as Record<string, string | undefined>;

        if (!entityType || !entityName) {
          res.status(400).json({ error: 'entityType and entityName query params are required' });
          return;
        }

        const definitions = await repository.getDefinitionsByEntity(entityType, entityName);
        res.json({ data: definitions });
      } catch (err) {
        next(err);
      }
    })();
  });

  router.get('/:hash', (req, res, next) => {
    void (async () => {
      try {
        const { hash } = req.params;
        const definition = await repository.getDefinitionByHash(hash);
        if (!definition) {
          res.status(404).json({ error: 'Definition not found' });
          return;
        }
        res.json(definition);
      } catch (err) {
        next(err);
      }
    })();
  });

  router.put('/:hash', (req, res, next) => {
    void (async () => {
      try {
        const { hash } = req.params;
        const parsed = DefinitionBodySchema.safeParse(req.body);
        if (!parsed.success) {
          res.status(400).json({ error: 'Invalid request body', details: parsed.error.issues });
          return;
        }

        const { content, entityType, entityName, version } = parsed.data;
        await repository.upsertDefinition(hash, content, entityType, entityName, version ?? null);

        const definition = await repository.getDefinitionByHash(hash);
        res.status(201).json(definition);
      } catch (err) {
        next(err);
      }
    })();
  });

  return router;
}
