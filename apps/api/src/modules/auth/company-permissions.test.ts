import { describe, expect, it } from 'vitest';
import {
  assertAssignableGrantKeys,
  effectivePermissionKeys,
  factoryTemplateKeys,
  viewerPermissionKeys,
} from './company-permissions';
import { permissionCatalog, teamPermissionCatalog } from './rbac';

const tenantKeys = permissionCatalog.map((item) => item.key);
const teamKeys = teamPermissionCatalog.map((item) => item.key);
const fullCatalog = [...tenantKeys, ...teamKeys].sort((left, right) =>
  left.localeCompare(right),
);

describe('effectivePermissionKeys', () => {
  it('gives the owner the full catalog even when stored grants are empty or partial', () => {
    const empty = effectivePermissionKeys({
      role: 'OWNER',
      grants: [],
    });
    const revoked = effectivePermissionKeys({
      role: 'OWNER',
      grants: ['tenant.read'],
    });

    expect(empty.permissions).toEqual([...tenantKeys].sort());
    expect(empty.teamPermissions).toEqual([...teamKeys].sort());
    expect(revoked.permissions).toEqual(empty.permissions);
    expect(revoked.teamPermissions).toEqual(empty.teamPermissions);
    expect([...empty.permissions, ...empty.teamPermissions].sort()).toEqual(
      fullCatalog,
    );
  });

  it('uses only the stored grants for an admin or a user', () => {
    const grants = ['tenant.read', 'dashboard.view'];
    const admin = effectivePermissionKeys({ role: 'ADMIN', grants });
    const user = effectivePermissionKeys({ role: 'USER', grants });

    expect(admin.permissions).toEqual(['tenant.read']);
    expect(admin.teamPermissions).toEqual(['dashboard.view']);
    expect(user).toEqual(admin);
  });

  it('drops owner-only keys stored on a non-owner', () => {
    const effective = effectivePermissionKeys({
      role: 'ADMIN',
      grants: ['tenant.read', 'permissions.manage'],
    });

    expect(effective.permissions).toEqual(['tenant.read']);
    expect(effective.permissions).not.toContain('permissions.manage');
  });
});

describe('factory templates', () => {
  it('gives a new admin every permission that is not owner-only', () => {
    const admin = factoryTemplateKeys('ADMIN');
    const ownerOnly = permissionCatalog
      .filter((item) => item.ownerOnly)
      .map((item) => item.key);

    expect(ownerOnly).toEqual(['permissions.manage']);
    expect(admin).toEqual(
      fullCatalog.filter((key) => key !== 'permissions.manage').sort(),
    );
    expect(admin).not.toContain('permissions.manage');
    expect(admin).toContain('users.manage');
    expect(admin).toContain('teams.manage');
    expect(admin).toContain('dashboard.view');
  });

  it('documents the user template as the visualizador read and view set', () => {
    const user = factoryTemplateKeys('USER');

    expect(user).toEqual([...viewerPermissionKeys].sort());
    expect(user.every((key) => !key.endsWith('.manage'))).toBe(true);
    expect(user).toContain('tenant.read');
    expect(user).toContain('users.read');
    expect(user).toContain('teams.read');
    expect(user).toContain('dashboard.view');
    expect(user).not.toContain('management.view');
    expect(user).not.toContain('users.manage');
    expect(user).not.toContain('permissions.manage');
  });
});

describe('assertAssignableGrantKeys', () => {
  it('rejects keys outside the catalog and owner-only keys', () => {
    expect(() => assertAssignableGrantKeys(['tenant.read'])).not.toThrow();
    expect(() => assertAssignableGrantKeys(['not.a.key'])).toThrow(
      /not\.a\.key/,
    );
    expect(() => assertAssignableGrantKeys(['permissions.manage'])).toThrow(
      /permissions\.manage/,
    );
  });
});
