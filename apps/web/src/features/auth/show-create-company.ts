export function showCreateCompany(
  tenant: { id: string; slug: string; name: string } | null,
): boolean {
  return tenant === null;
}
