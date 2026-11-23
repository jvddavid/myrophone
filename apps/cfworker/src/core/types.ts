export interface Env {
  API_ORIGIN: string;
  TENANT_DB: D1Database;
}

export interface IngestPayload {
  [key: string]: unknown;
}

export interface TenantIngestPathResult {
  tenantId: string | null;
}

export function resolveTenantIdFromPath(
  pathname: string,
): TenantIngestPathResult {
  const tenantId = pathname.split('/').at(-1)?.trim().toLowerCase() ?? null;
  return {
    tenantId: tenantId || null,
  };
}
