import { normalizeTenantId } from '@myrophone/shared';

export interface LeadJob {
  tenantId: string;
  leadId: string;
  payload: Record<string, unknown>;
}

export interface ProcessedLeadResult {
  tenantId: string;
  leadId: string;
  processedAt: string;
  status: 'processed';
}

export async function processLeadJob(
  job: LeadJob,
): Promise<ProcessedLeadResult> {
  return {
    tenantId: normalizeTenantId(job.tenantId),
    leadId: job.leadId,
    processedAt: new Date().toISOString(),
    status: 'processed',
  };
}
