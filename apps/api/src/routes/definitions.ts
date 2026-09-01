import { Router } from 'express';
import { z } from 'zod';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { createHash } from 'node:crypto';

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

        if (!entityType && !entityName) {
          // List all definitions
          const definitions = await repository.getAllDefinitions();
          res.json({ data: definitions });
          return;
        }

        if (!entityType || !entityName) {
          res.status(400).json({ error: 'Both entityType and entityName are required when filtering' });
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

  /**
   * POST /refresh-selective — Upload definitions only for skills/agents
   * that have actually been used in events.
   */
  router.post('/refresh-selective', (req, res, next) => {
    void (async () => {
      try {
        const { skills: usedSkills, agents: usedAgents } = await repository.getUsedEntityNames();

        const globalConfigDir = process.env.HOST_OPENCODE_DIR ?? join(homedir(), '.config', 'opencode');
        const skillsDir = join(globalConfigDir, 'skills');
        const agentsDir = join(globalConfigDir, 'agents');

        const uploaded: Array<{ name: string; type: string; hash: string }> = [];
        const skipped: Array<{ name: string; type: string; reason: string }> = [];

        // Upload used skills
        for (const skillName of usedSkills) {
          const skillDir = join(skillsDir, skillName);
          const skillFile = join(skillDir, 'SKILL.md');

          if (!existsSync(skillFile)) {
            skipped.push({ name: skillName, type: 'skill', reason: 'file not found' });
            continue;
          }

          try {
            const content = readFileSync(skillFile, 'utf-8');
            const hash = createHash('sha256').update(content).digest('hex');

            // Check if already uploaded with same content
            const existing = await repository.getDefinitionByHash(hash);
            if (existing) {
              skipped.push({ name: skillName, type: 'skill', reason: 'already up to date' });
              continue;
            }

            await repository.upsertDefinition(hash, content, 'skill', skillName, null);
            uploaded.push({ name: skillName, type: 'skill', hash });
          } catch (err) {
            skipped.push({ name: skillName, type: 'skill', reason: String(err) });
          }
        }

        // Upload used agents
        for (const agentName of usedAgents) {
          const agentDir = join(agentsDir, agentName);
          const agentFile = join(agentDir, 'AGENT.md');

          if (!existsSync(agentFile)) {
            skipped.push({ name: agentName, type: 'agent', reason: 'file not found' });
            continue;
          }

          try {
            const content = readFileSync(agentFile, 'utf-8');
            const hash = createHash('sha256').update(content).digest('hex');

            const existing = await repository.getDefinitionByHash(hash);
            if (existing) {
              skipped.push({ name: agentName, type: 'agent', reason: 'already up to date' });
              continue;
            }

            await repository.upsertDefinition(hash, content, 'agent', agentName, null);
            uploaded.push({ name: agentName, type: 'agent', hash });
          } catch (err) {
            skipped.push({ name: agentName, type: 'agent', reason: String(err) });
          }
        }

        res.json({
          uploaded: uploaded.length,
          skipped: skipped.length,
          details: { uploaded, skipped },
        });
      } catch (err) {
        next(err);
      }
    })();
  });

  return router;
}
