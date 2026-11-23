import {
  WorkflowEntrypoint,
  type WorkflowEvent,
  type WorkflowStep,
} from 'cloudflare:workers';
import type { Env, LeadWorkflowParams } from '../../core/types';

export class LeadWorkflow extends WorkflowEntrypoint<Env, LeadWorkflowParams> {
  async run(
    event: WorkflowEvent<LeadWorkflowParams>,
    step: WorkflowStep,
  ): Promise<Record<string, unknown>> {
    const normalized = await step.do('normalize-input', async () => ({
      tenantId: event.payload.tenantId.trim().toLowerCase(),
      leadId: event.payload.leadId,
      payloadJson: event.payload.payloadJson,
    }));

    await step.sleep('rate-limit-window', '3 seconds');

    return step.do('finalize', async () => ({
      status: 'processed-by-cloudflare-workflow',
      processedAt: new Date().toISOString(),
      tenantId: normalized.tenantId,
      leadId: normalized.leadId,
      payloadJson: normalized.payloadJson,
    }));
  }
}
