import pino from 'pino';
import { env } from './config/env';

export const logger = pino({
  name: 'myrophone-worker',
  level: env.LOG_LEVEL,
  timestamp: pino.stdTimeFunctions.isoTime,
  enabled: env.NODE_ENV !== 'test',
  base: {
    service: 'worker',
  },
});
