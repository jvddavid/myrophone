import {
  getJobDefinition,
  type TenantHierarchyExportJobData,
  type TenantHierarchyExportResult,
} from '@myrophone/shared';
import { Queue } from 'bullmq';
import type { RedisOptions } from 'ioredis';
import { env } from '../core/config/env';
import type { LeadJob } from '../modules/lead-processing/processor';

export const connection: RedisOptions = {
  host: env.REDIS_HOST,
  port: env.REDIS_PORT,
  maxRetriesPerRequest: null,
};

const leadProcessingJob = getJobDefinition('leadProcessing');
const hierarchyExportJob = getJobDefinition('tenantHierarchyExport');

export const leadQueueName = leadProcessingJob.queueName;
export const hierarchyExportQueueName = hierarchyExportJob.queueName;

export const leadQueue = new Queue<LeadJob>(leadQueueName, { connection });

export const hierarchyExportQueue = new Queue<
  TenantHierarchyExportJobData,
  TenantHierarchyExportResult
>(hierarchyExportQueueName, {
  connection,
});

export async function enqueueLeadJob(payload: LeadJob): Promise<void> {
  await leadQueue.add(leadProcessingJob.jobName, payload, {
    jobId: `lead:${payload.leadId}`,
    attempts: leadProcessingJob.defaults.attempts,
    backoff: {
      type: 'exponential',
      delay: leadProcessingJob.defaults.backoffDelayMs,
    },
    removeOnComplete: 1000,
    removeOnFail: 5000,
  });
}
