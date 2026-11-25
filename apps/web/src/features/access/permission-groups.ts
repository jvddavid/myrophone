export interface PermissionCatalogEntry {
  key: string;
  description: string;
  group: string;
  scope: string;
}

const groupOrder = [
  'Empresa',
  'Pessoas',
  'Departamentos',
  'Permissões',
  'Auditoria',
  'Telas',
] as const;

export function groupCatalog(
  catalog: readonly PermissionCatalogEntry[],
): Array<{ group: string; entries: PermissionCatalogEntry[] }> {
  const buckets = new Map<string, PermissionCatalogEntry[]>();

  for (const entry of catalog) {
    const entries = buckets.get(entry.group) ?? [];
    entries.push(entry);
    buckets.set(entry.group, entries);
  }

  const known = new Set<string>(groupOrder);
  const ordered = groupOrder.flatMap((group) => {
    const entries = buckets.get(group);
    return entries ? [{ group, entries }] : [];
  });
  const extras = [...buckets.keys()]
    .filter((group) => !known.has(group))
    .sort((left, right) => left.localeCompare(right))
    .map((group) => ({
      group,
      entries: buckets.get(group) ?? [],
    }));

  return [...ordered, ...extras];
}

export function togglePermissionKey(
  keys: readonly string[],
  key: string,
  enabled: boolean,
): string[] {
  const next = new Set(keys);

  if (enabled) {
    next.add(key);
  } else {
    next.delete(key);
  }

  return [...next].sort((left, right) => left.localeCompare(right));
}

export function samePermissionKeys(
  left: readonly string[],
  right: readonly string[],
): boolean {
  if (left.length !== right.length) {
    return false;
  }

  const rightKeys = new Set(right);
  return left.every((key) => rightKeys.has(key));
}
