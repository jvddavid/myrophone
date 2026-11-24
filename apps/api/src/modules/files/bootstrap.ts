import { env } from '../../core/config/env';
import { logger } from '../../core/logger';
import { getFileStorage } from './storage';

export async function ensureStorageReady(options?: {
  nodeEnv?: string;
  ensureBuckets?: () => Promise<void>;
}): Promise<void> {
  const nodeEnv = options?.nodeEnv ?? env.NODE_ENV;

  if (nodeEnv === 'test') {
    return;
  }

  try {
    if (options?.ensureBuckets) {
      await options.ensureBuckets();
    } else {
      await getFileStorage().ensureBuckets();
    }
  } catch (error) {
    if (nodeEnv === 'development') {
      logger.warn(
        { err: error },
        'MinIO is unavailable. File routes will return 503 until storage is reachable.',
      );
      return;
    }

    logger.error({ err: error }, 'Failed to prepare file storage buckets');
    throw error;
  }
}
