import { app } from './app';
import { env } from './core/config/env';
import { logger } from './core/logger';

export type { App } from './app';
export { app };

if (import.meta.main) {
  app.listen(env.PORT);
  logger.info({ port: env.PORT }, 'API server started');
}
