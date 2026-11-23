import type { Env } from './core/types';
import { handleHealthRequest } from './modules/health/handler';
import { handleIngestRequest } from './modules/ingest/handler';

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === 'POST' && url.pathname.startsWith('/ingest/')) {
      return handleIngestRequest(request, env);
    }

    if (request.method === 'GET' && url.pathname === '/health') {
      return handleHealthRequest(env);
    }

    return new Response('Not found', { status: 404 });
  },
};
