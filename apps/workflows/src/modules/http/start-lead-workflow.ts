import type { Env, StartLeadWorkflowBody } from '../../core/types';

export async function handleStartLeadWorkflow(
  request: Request,
  env: Env,
): Promise<Response> {
  const payload = (await request.json()) as StartLeadWorkflowBody;
  const id = crypto.randomUUID();

  await env.LEAD_WORKFLOW.create({
    id,
    params: {
      tenantId: payload.tenantId,
      leadId: payload.leadId,
      payloadJson: JSON.stringify(payload.payload ?? {}),
    },
  });

  return Response.json({ id, status: 'started' }, { status: 202 });
}
