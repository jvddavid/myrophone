export type TenantId = string;

export interface TenantContext {
  tenantId: TenantId;
  plan?: 'starter' | 'growth' | 'enterprise';
  region?: string;
}

export function normalizeTenantId(value: string): TenantId {
  return value.trim().toLowerCase();
}

export function buildTenantKey(tenantId: TenantId, suffix: string): string {
  return `${normalizeTenantId(tenantId)}:${suffix}`;
}
