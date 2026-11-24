import { env } from '../../core/config/env';
import { getPrisma } from '../../core/db/prisma';
import { createPrismaFilesDb } from './prisma-files-db';
import { createFilesService } from './service';
import { getFileStorage } from './storage';

export async function getFilesService() {
  const db = await getPrisma();

  return createFilesService({
    db: createPrismaFilesDb(db),
    storage: getFileStorage(),
    publicBucket: env.S3_PUBLIC_BUCKET,
    privateBucket: env.S3_PRIVATE_BUCKET,
  });
}
