export interface CompanyMembershipChoice {
  tenantId: string;
  createdAt: Date;
  status: string;
}

export function chooseActiveTenantId(
  memberships: CompanyMembershipChoice[],
  lastTenantId: string | null,
): string | null {
  const active = memberships
    .filter((membership) => membership.status === 'ACTIVE')
    .sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime());

  if (active.length === 0) {
    return null;
  }

  const saved = active.find((membership) => membership.tenantId === lastTenantId);
  return (saved ?? active[0]).tenantId;
}

export function withSlugSuffix(base: string, attempt: number): string {
  if (attempt <= 1) {
    return base;
  }

  return `${base}-${attempt}`;
}
