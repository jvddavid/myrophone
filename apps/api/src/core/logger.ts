import pino from 'pino';
import { env } from './config/env';

export const logger = pino({
  name: 'myrophone-api',
  level: env.LOG_LEVEL,
  timestamp: pino.stdTimeFunctions.isoTime,
  enabled: env.NODE_ENV !== 'test' || env.LOG_HTTP_REQUESTS,
  base: {
    service: 'api',
  },
});
