import { pinoIntegration } from '@sentry/bun';
import * as Sentry from '@sentry/elysia';
import { env } from './core/config/env';

if (env.SENTRY_DSN && env.NODE_ENV !== 'test') {
  Sentry.init({
    dsn: env.SENTRY_DSN,
    environment: env.NODE_ENV,
    tracesSampleRate: env.NODE_ENV === 'production' ? 0.1 : 1,
    integrations: [
      pinoIntegration({
        log: { levels: ['info', 'warn', 'error', 'fatal'] },
        error: { levels: ['error', 'fatal'] },
      }),
    ],
  });
}
