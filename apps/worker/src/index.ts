import type {
  TenantHierarchyExportJobData,
  TenantHierarchyExportResult,
} from '@myrophone/shared';
import { getJobDefinition } from '@myrophone/shared';
import { Worker } from 'bullmq';
import { env } from './core/config/env';
import { getJobConcurrency, getJobTimeoutMs } from './core/jobs/runtime-config';
import { logger } from './core/logger';
import { connection, leadQueueName } from './infra/queue';
import { processLeadJob } from './modules/lead-processing/processor';
import { processTenantHierarchyExportJob } from './modules/tenant-hierarchy-export/processor';

const hierarchyExportJob = getJobDefinition('tenantHierarchyExport');

const leadWorker = new Worker(
  leadQueueName,
  async (job) => {
    const result = await processLeadJob(job.data);
    return result;
  },
  { connection },
);

const hierarchyExportWorker = new Worker<
  TenantHierarchyExportJobData,
  TenantHierarchyExportResult
>(
  hierarchyExportJob.queueName,
  async (job) =>
    processTenantHierarchyExportJob(job.data, {
      timeoutMs: getJobTimeoutMs('tenantHierarchyExport'),
      onProgress: async (progress) => {
        await job.updateProgress(progress);
      },
    }),
  {
    connection,
    concurrency: getJobConcurrency('tenantHierarchyExport'),
  },
);

leadWorker.on('completed', (job) => {
  logger.info(
    {
      queue: leadQueueName,
      jobId: job.id,
      jobName: job.name,
    },
    'Lead job completed',
  );
});

leadWorker.on('failed', (job, error) => {
  logger.error(
    {
      queue: leadQueueName,
      jobId: job?.id,
      jobName: job?.name,
      err: error,
    },
    'Lead job failed',
  );
});

hierarchyExportWorker.on('completed', (job) => {
  logger.info(
    {
      queue: hierarchyExportJob.queueName,
      jobId: job.id,
      jobName: job.name,
    },
    'Hierarchy export job completed',
  );
});

hierarchyExportWorker.on('failed', (job, error) => {
  logger.error(
    {
      queue: hierarchyExportJob.queueName,
      jobId: job?.id,
      jobName: job?.name,
      err: error,
    },
    'Hierarchy export job failed',
  );
});

process.on('SIGTERM', async () => {
  logger.info('Received SIGTERM, shutting down workers');
  await Promise.all([leadWorker.close(), hierarchyExportWorker.close()]);
  logger.info('Workers stopped gracefully');
  process.exit(0);
});

logger.info(
  {
    redisHost: env.REDIS_HOST,
    redisPort: env.REDIS_PORT,
    leadQueue: leadQueueName,
    hierarchyQueue: hierarchyExportJob.queueName,
    hierarchyConcurrency: getJobConcurrency('tenantHierarchyExport'),
  },
  'BullMQ workers started',
);
