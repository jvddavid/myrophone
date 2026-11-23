import type { Env, IngestPayload } from '../../core/types';
import { resolveTenantIdFromPath } from '../../core/types';

export async function handleIngestRequest(
  request: Request,
  env: Env,
): Promise<Response> {
  const url = new URL(request.url);
  const { tenantId } = resolveTenantIdFromPath(url.pathname);

  if (!tenantId) {
    return Response.json({ error: 'tenantId is required' }, { status: 400 });
  }

  const payload = await request.json<IngestPayload>();

  await env.TENANT_DB.prepare(
    "INSERT INTO leads (tenant_id, payload, created_at) VALUES (?1, ?2, datetime('now'))",
  )
    .bind(tenantId, JSON.stringify(payload))
    .run();

  return Response.json({
    ok: true,
    tenantId,
    routedTo: 'cloudflare-edge',
  });
}
