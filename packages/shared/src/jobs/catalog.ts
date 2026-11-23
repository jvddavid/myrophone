interface JobDefaults {
  timeoutMs: number;
  concurrency: number;
  attempts: number;
  backoffDelayMs: number;
}

export const jobCatalog = {
  leadProcessing: {
    key: 'leadProcessing',
    queueName: 'lead-processing',
    jobName: 'lead:process',
    defaults: {
      timeoutMs: 30_000,
      concurrency: 4,
      attempts: 3,
      backoffDelayMs: 1_000,
    },
  },
  tenantHierarchyExport: {
    key: 'tenantHierarchyExport',
    queueName: 'tenant-hierarchy-export',
    jobName: 'tenant-hierarchy-export:pdf',
    defaults: {
      timeoutMs: 120_000,
      concurrency: 2,
      attempts: 2,
      backoffDelayMs: 5_000,
    },
  },
} as const satisfies Record<
  string,
  {
    key: string;
    queueName: string;
    jobName: string;
    defaults: JobDefaults;
  }
>;

export type AppJobKey = keyof typeof jobCatalog;
export type AppJobDefinition<K extends AppJobKey = AppJobKey> =
  (typeof jobCatalog)[K];

export function getJobDefinition<K extends AppJobKey>(
  jobKey: K,
): AppJobDefinition<K> {
  return jobCatalog[jobKey];
}

export const LEAD_PROCESSING_QUEUE_NAME = jobCatalog.leadProcessing.queueName;
export const LEAD_PROCESSING_JOB_NAME = jobCatalog.leadProcessing.jobName;

export const TENANT_HIERARCHY_EXPORT_QUEUE_NAME =
  jobCatalog.tenantHierarchyExport.queueName;
export const TENANT_HIERARCHY_EXPORT_JOB_NAME =
  jobCatalog.tenantHierarchyExport.jobName;

export const queueJobStateCatalog = [
  'waiting',
  'active',
  'completed',
  'failed',
  'delayed',
  'paused',
  'waiting-children',
  'prioritized',
  'unknown',
] as const;

export type QueueJobState = (typeof queueJobStateCatalog)[number];

export function normalizeQueueJobState(value: string): QueueJobState {
  const normalized = queueJobStateCatalog.find((state) => state === value);
  return normalized ?? 'unknown';
}
