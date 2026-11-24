import './instrument';
import { app } from './app';
import { env } from './core/config/env';
import { logger } from './core/logger';
import { ensureStorageReady } from './modules/files/bootstrap';

export type { App } from './app';
export { app };

if (import.meta.main) {
  void ensureStorageReady()
    .then(() => {
      app.listen(env.PORT);
      logger.info({ port: env.PORT }, 'API server started');
    })
    .catch((error: unknown) => {
      logger.error({ err: error }, 'API failed to start');
      process.exit(1);
    });
}
