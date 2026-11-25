import { AppError } from '../../core/errors/app-error';
import {
  legacyUserGrantKeys,
  permissionCatalog,
  teamPermissionCatalog,
  viewerPermissionKeys,
} from './rbac';

export { legacyUserGrantKeys, viewerPermissionKeys };

export interface EffectivePermissions {
  permissions: string[];
  teamPermissions: string[];
}

export interface CatalogEntry {
  key: string;
  description: string;
  group: string;
  scope: 'tenant' | 'team';
}

const tenantKeySet = new Set<string>(permissionCatalog.map((item) => item.key));
const teamKeySet = new Set<string>(
  teamPermissionCatalog.map((item) => item.key),
);
const ownerOnlyKeySet = new Set<string>(
  permissionCatalog.filter((item) => item.ownerOnly).map((item) => item.key),
);

function sorted(keys: Iterable<string>): string[] {
  return [...keys].sort((left, right) => left.localeCompare(right));
}

export function assignablePermissionKeys(): string[] {
  return sorted(
    [...tenantKeySet, ...teamKeySet].filter((key) => !ownerOnlyKeySet.has(key)),
  );
}

export function factoryTemplateKeys(role: 'ADMIN' | 'USER'): string[] {
  if (role === 'ADMIN') {
    return assignablePermissionKeys();
  }

  return sorted(viewerPermissionKeys);
}

export function assignableCatalog(): CatalogEntry[] {
  const tenantEntries: CatalogEntry[] = permissionCatalog
    .filter((item) => !item.ownerOnly)
    .map((item) => ({
      key: item.key,
      description: item.description,
      group: item.group,
      scope: 'tenant',
    }));
  const teamEntries: CatalogEntry[] = teamPermissionCatalog.map((item) => ({
    key: item.key,
    description: item.description,
    group: item.group,
    scope: 'team',
  }));

  return [...tenantEntries, ...teamEntries];
}

export function effectivePermissionKeys(input: {
  role: string;
  grants: readonly string[];
}): EffectivePermissions {
  if (input.role === 'OWNER') {
    return {
      permissions: sorted(permissionCatalog.map((item) => item.key)),
      teamPermissions: sorted(teamPermissionCatalog.map((item) => item.key)),
    };
  }

  const permissions: string[] = [];
  const teamPermissions: string[] = [];

  for (const key of input.grants) {
    if (ownerOnlyKeySet.has(key)) {
      continue;
    }

    if (tenantKeySet.has(key)) {
      permissions.push(key);
      continue;
    }

    if (teamKeySet.has(key)) {
      teamPermissions.push(key);
    }
  }

  return {
    permissions: sorted(new Set(permissions)),
    teamPermissions: sorted(new Set(teamPermissions)),
  };
}

export function assertAssignableGrantKeys(keys: readonly string[]): void {
  const assignable = new Set(assignablePermissionKeys());

  for (const key of keys) {
    if (ownerOnlyKeySet.has(key)) {
      throw new AppError({
        statusCode: 400,
        code: 'INVALID_PERMISSION_KEYS',
        message: `Permission '${key}' is reserved for the company owner.`,
      });
    }

    if (!assignable.has(key)) {
      throw new AppError({
        statusCode: 400,
        code: 'INVALID_PERMISSION_KEYS',
        message: `Permission '${key}' is not in the catalog.`,
      });
    }
  }
}

export function grantsAllow(
  role: string,
  grants: readonly string[],
  permissionKey: string,
): boolean {
  const effective = effectivePermissionKeys({ role, grants });

  return (
    effective.permissions.includes(permissionKey) ||
    effective.teamPermissions.includes(permissionKey)
  );
}
