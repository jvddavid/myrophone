import * as Sentry from '@sentry/react';
import { router } from './router';

const dsn = import.meta.env.VITE_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    integrations: [
      Sentry.tanstackRouterBrowserTracingIntegration(router),
      Sentry.replayIntegration(),
    ],
    tracesSampleRate: import.meta.env.PROD ? 0.1 : 1,
    tracePropagationTargets: [
      'localhost',
      /^https?:\/\/127\.0\.0\.1(?::\d+)?/,
      /^\//,
    ],
    replaysSessionSampleRate: import.meta.env.PROD ? 0.1 : 1,
    replaysOnErrorSampleRate: 1,
  });
}
