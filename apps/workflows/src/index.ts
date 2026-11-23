import type { Env } from './core/types';
import { handleWorkflowHealth } from './modules/http/health';
import { handleStartLeadWorkflow } from './modules/http/start-lead-workflow';
import { LeadWorkflow } from './modules/lead-workflow/entrypoint';

export { LeadWorkflow };

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === 'POST' && url.pathname === '/workflows/lead') {
      return handleStartLeadWorkflow(request, env);
    }

    return handleWorkflowHealth();
  },
};
