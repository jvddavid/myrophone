import './instrument';
import * as Sentry from '@sentry/elysia';
import { Elysia } from 'elysia';
import { httpMiddlewares } from './core/http/http-middlewares';
import { authRoutes } from './modules/auth/http/auth.routes';
import { managementRoutes } from './modules/auth/http/management.routes';
import { jobsRoutes } from './modules/jobs/http/jobs.routes';

export const app = Sentry.withElysia(new Elysia())
  .use(httpMiddlewares)
  .get('/health', () => ({
    service: 'api',
    status: 'ok',
  }))
  .use(authRoutes)
  .use(managementRoutes)
  .use(jobsRoutes);

export type App = typeof app;
