import type { Env } from '../../core/types';

export function handleHealthRequest(env: Env): Response {
  return Response.json({
    service: 'cfworker',
    status: 'ok',
    apiOrigin: env.API_ORIGIN,
  });
}
