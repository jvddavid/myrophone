import { Elysia } from 'elysia';
import { env } from './core/config/env';
import { httpMiddlewares } from './core/http/http-middlewares';
import { logger } from './core/logger';
import { authRoutes } from './modules/auth/http/auth.routes';
import { managementRoutes } from './modules/auth/http/management.routes';
import { jobsRoutes } from './modules/jobs/http/jobs.routes';

export const app = new Elysia()
  .use(httpMiddlewares)
  .get('/health', () => ({
    service: 'api',
    status: 'ok',
  }))
  .use(authRoutes)
  .use(managementRoutes)
  .use(jobsRoutes);

if (import.meta.main) {
  app.listen(env.PORT);
  logger.info({ port: env.PORT }, 'API server started');
}
