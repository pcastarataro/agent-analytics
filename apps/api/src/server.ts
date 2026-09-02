import cors from 'cors';
import express from 'express';
import { z } from 'zod';

import type { EventRepository, UserRepository } from '@agent-analytics/database';

import { apiKeyAuth, jwtAuth } from './middleware/auth';
import { errorHandler } from './middleware/error-handler';
import { validateBody } from './middleware/validate';
import { createAuthRoutes } from './routes/auth';
import { createEventRoutes } from './routes/events';
import { createHealthRoutes } from './routes/health';
import { createSessionRoutes } from './routes/sessions';
import { createStatsRoutes } from './routes/stats';
import { createDefinitionRoutes } from './routes/definitions';
import { createUserRoutes } from './routes/users';
import type { ApiConfig } from './config';

export function createApp(
  config: ApiConfig,
  repository: EventRepository,
  userRepository: UserRepository,
) {
  const app = express();

  app.use(cors({ origin: config.corsOrigins }));
  app.use(express.json());

  // Health — no auth
  app.use('/health', createHealthRoutes());

  // Auth — no auth required
  app.use('/v1/auth', createAuthRoutes(userRepository, config.jwtSecret));

  // User management — JWT protected
  app.use('/v1/users', jwtAuth(config.jwtSecret), createUserRoutes(userRepository));

  // Events — API key protected
  app.use('/v1/events/batch', apiKeyAuth(userRepository), validateBody(z.array(z.unknown())), createEventRoutes(repository));
  app.use('/v1/events', apiKeyAuth(userRepository), createEventRoutes(repository));
  app.use('/v1/sessions', createSessionRoutes(repository));
  app.use('/v1/stats', apiKeyAuth(userRepository), createStatsRoutes(repository));
  app.use('/v1/definitions', createDefinitionRoutes(repository));

  app.use(errorHandler);

  return app;
}
