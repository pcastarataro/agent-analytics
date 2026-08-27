import cors from 'cors';
import express from 'express';
import { z } from 'zod';

import type { EventRepository } from '@agent-analytics/database';

import { authStub } from './middleware/auth';
import { errorHandler } from './middleware/error-handler';
import { validateBody } from './middleware/validate';
import { createEventRoutes } from './routes/events';
import { createHealthRoutes } from './routes/health';
import { createSessionRoutes } from './routes/sessions';
import { createStatsRoutes } from './routes/stats';
import type { ApiConfig } from './config';

export function createApp(config: ApiConfig, repository: EventRepository) {
  const app = express();

  app.use(cors({ origin: config.corsOrigins }));
  app.use(express.json());

  app.use('/health', createHealthRoutes());

  app.use(authStub);

  app.use('/v1/events/batch', validateBody(z.array(z.unknown())), createEventRoutes(repository));
  app.use('/v1/events', createEventRoutes(repository));
  app.use('/v1/sessions', createSessionRoutes(repository));
  app.use('/v1/stats', createStatsRoutes(repository));

  app.use(errorHandler);

  return app;
}
