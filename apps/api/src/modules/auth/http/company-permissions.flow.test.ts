import { afterAll, describe, expect, it } from 'vitest';
import { getPrisma } from '../../../core/db/prisma';
import {
  factoryTemplateKeys,
  viewerPermissionKeys,
} from '../company-permissions';
import { asType } from '../db-types';
import { permissionCatalog, teamPermissionCatalog } from '../rbac';
import {
  cleanupAuthTests,
  getAuth,
  patchAuth,
  postAuth,
  putAuth,
} from './auth-flow-client';

const password = 'senha-forte';
const fullCatalog = [
  ...permissionCatalog.map((item) => item.key),
  ...teamPermissionCatalog.map((item) => item.key),
].sort();

afterAll(async () => {
  await cleanupAuthTests();
});

async function registerOwner(label: string): Promise<{
  email: string;
  accessToken: string;
  userId: string;
  tenantId: string;
}> {
  const email = `${label}-${crypto.randomUUID()}@auth-test.local`;
  const registered = await postAuth('/auth/register', {
    name: 'Dona Teste',
    phone: '11987654321',
    email,
    password,
  });
  expect(registered.status).toBe(201);
  const tokens = registered.body.tokens as {
    accessToken: string;
    refreshToken: string;
  };
  const created = await postAuth(
    '/auth/companies',
    {
      name: `Auth Test ${label}`,
      description: 'Empresa de teste',
      refreshToken: tokens.refreshToken,
    },
    tokens.accessToken,
  );
  expect(created.status).toBe(200);

  return {
    email,
    accessToken: (created.body.tokens as { accessToken: string }).accessToken,
    userId: (created.body.user as { id: string }).id,
    tenantId: (created.body.tenant as { id: string }).id,
  };
}

async function memberToken(
  ownerToken: string,
  roleName: 'ADMIN' | 'USER',
  label: string,
): Promise<{ email: string; accessToken: string; userId: string }> {
  const email = `${label}-${crypto.randomUUID()}@auth-test.local`;
  const created = await postAuth(
    '/users',
    {
      name: 'Pessoa Teste',
      email,
      password,
      roleName,
    },
    ownerToken,
  );
  expect(created.status).toBe(201);
  const login = await postAuth('/auth/login', { email, password });
  expect(login.status).toBe(200);

  return {
    email,
    accessToken: (login.body.tokens as { accessToken: string }).accessToken,
    userId: (login.body.user as { id: string }).id,
  };
}

function permissionKeys(body: Record<string, unknown>): string[] {
  const permissions = body.permissions as string[];
  const teamPermissions = body.teamPermissions as string[];

  return [...permissions, ...teamPermissions].sort();
}

describe('company permission templates and grants', () => {
  it('gives the owner the full catalog even after a stored revocation', async () => {
    const owner = await registerOwner('perm-owner');
    const me = await getAuth('/permissions/me', owner.accessToken);
    const prisma = await getPrisma();
    const membership = asType<{ id: string }>(
      await prisma.membership.findFirst({
        where: { tenantId: owner.tenantId, userId: owner.userId },
        select: { id: true },
      }),
    );
    await prisma.membershipPermissionGrant.create({
      data: { membershipId: membership.id, permissionKey: 'tenant.read' },
    });
    const again = await getAuth('/permissions/me', owner.accessToken);

    expect(me.status).toBe(200);
    expect(permissionKeys(me.body)).toEqual(fullCatalog);
    expect(permissionKeys(again.body)).toEqual(fullCatalog);
  });

  it('copies the admin template onto a new admin and the user template onto a new user', async () => {
    const owner = await registerOwner('perm-copy');
    const admin = await memberToken(owner.accessToken, 'ADMIN', 'perm-admin');
    const user = await memberToken(owner.accessToken, 'USER', 'perm-user');
    const adminMe = await getAuth('/permissions/me', admin.accessToken);
    const userMe = await getAuth('/permissions/me', user.accessToken);

    expect(permissionKeys(adminMe.body)).toEqual(factoryTemplateKeys('ADMIN'));
    expect(permissionKeys(userMe.body)).toEqual(
      [...viewerPermissionKeys].sort(),
    );
    expect(permissionKeys(adminMe.body)).not.toContain('permissions.manage');
  });

  it('keeps an existing member when the company template changes', async () => {
    const owner = await registerOwner('perm-future');
    const admin = await memberToken(
      owner.accessToken,
      'ADMIN',
      'perm-future-admin',
    );
    const before = await getAuth('/permissions/me', admin.accessToken);
    const narrowed = factoryTemplateKeys('ADMIN').filter(
      (key) => key !== 'teams.manage',
    );
    const updated = await putAuth(
      '/companies/permission-templates',
      { role: 'ADMIN', permissionKeys: narrowed },
      owner.accessToken,
    );
    const after = await getAuth('/permissions/me', admin.accessToken);
    const nextAdmin = await memberToken(
      owner.accessToken,
      'ADMIN',
      'perm-future-next',
    );
    const nextMe = await getAuth('/permissions/me', nextAdmin.accessToken);

    expect(updated.status).toBe(200);
    expect(permissionKeys(before.body)).toContain('teams.manage');
    expect(permissionKeys(after.body)).toEqual(permissionKeys(before.body));
    expect(permissionKeys(nextMe.body)).not.toContain('teams.manage');
    expect(permissionKeys(nextMe.body)).toEqual(narrowed.sort());
  });

  it('lets the owner revoke and restore a permission on an admin and on a user', async () => {
    const owner = await registerOwner('perm-toggle');
    const admin = await memberToken(
      owner.accessToken,
      'ADMIN',
      'perm-toggle-admin',
    );
    const user = await memberToken(
      owner.accessToken,
      'USER',
      'perm-toggle-user',
    );
    const adminBefore = permissionKeys(
      (await getAuth('/permissions/me', admin.accessToken)).body,
    );
    const userBefore = permissionKeys(
      (await getAuth('/permissions/me', user.accessToken)).body,
    );
    const adminRevoked = await putAuth(
      `/companies/members/${admin.userId}/permissions`,
      {
        permissionKeys: adminBefore.filter((key) => key !== 'users.manage'),
      },
      owner.accessToken,
    );
    const userRevoked = await putAuth(
      `/companies/members/${user.userId}/permissions`,
      {
        permissionKeys: userBefore.filter((key) => key !== 'users.read'),
      },
      owner.accessToken,
    );
    const adminAfter = permissionKeys(
      (await getAuth('/permissions/me', admin.accessToken)).body,
    );
    const userAfter = permissionKeys(
      (await getAuth('/permissions/me', user.accessToken)).body,
    );
    const adminRestored = await putAuth(
      `/companies/members/${admin.userId}/permissions`,
      { permissionKeys: adminBefore },
      owner.accessToken,
    );
    const userRestored = await putAuth(
      `/companies/members/${user.userId}/permissions`,
      { permissionKeys: userBefore },
      owner.accessToken,
    );

    expect(adminRevoked.status).toBe(200);
    expect(userRevoked.status).toBe(200);
    expect(adminAfter).not.toContain('users.manage');
    expect(userAfter).not.toContain('users.read');
    expect(adminRestored.status).toBe(200);
    expect(userRestored.status).toBe(200);
    expect(
      permissionKeys(
        (await getAuth('/permissions/me', admin.accessToken)).body,
      ),
    ).toEqual(adminBefore);
    expect(
      permissionKeys((await getAuth('/permissions/me', user.accessToken)).body),
    ).toEqual(userBefore);
  });

  it('rejects template and grant edits from an admin or a user, including owner-only keys and the owner', async () => {
    const owner = await registerOwner('perm-guard');
    const admin = await memberToken(
      owner.accessToken,
      'ADMIN',
      'perm-guard-admin',
    );
    const user = await memberToken(
      owner.accessToken,
      'USER',
      'perm-guard-user',
    );
    const templateDenied = await putAuth(
      '/companies/permission-templates',
      { role: 'USER', permissionKeys: ['tenant.read'] },
      admin.accessToken,
    );
    const grantDenied = await putAuth(
      `/companies/members/${user.userId}/permissions`,
      { permissionKeys: ['tenant.read'] },
      user.accessToken,
    );
    const ownerOnly = await putAuth(
      `/companies/members/${admin.userId}/permissions`,
      { permissionKeys: ['permissions.manage'] },
      owner.accessToken,
    );
    const unknown = await putAuth(
      `/companies/members/${admin.userId}/permissions`,
      { permissionKeys: ['not.a.key'] },
      owner.accessToken,
    );
    const ownerTarget = await putAuth(
      `/companies/members/${owner.userId}/permissions`,
      { permissionKeys: ['tenant.read'] },
      owner.accessToken,
    );
    const ownerRead = await getAuth(
      `/companies/members/${owner.userId}/permissions`,
      owner.accessToken,
    );

    expect(templateDenied.status).toBe(403);
    expect(grantDenied.status).toBe(403);
    expect(ownerOnly.status).toBe(400);
    expect(ownerOnly.body.error).toBe('INVALID_PERMISSION_KEYS');
    expect(unknown.status).toBe(400);
    expect(unknown.body.error).toBe('INVALID_PERMISSION_KEYS');
    expect(ownerTarget.status).toBe(409);
    expect(ownerTarget.body.error).toBe('OWNER_PERMISSIONS_LOCKED');
    expect(ownerRead.status).toBe(200);
    expect(ownerRead.body.locked).toBe(true);
    expect(ownerRead.body.permissionKeys).toEqual(fullCatalog);
  });

  it('rejects permission reads and writes from another company', async () => {
    const owner = await registerOwner('perm-tenant-a');
    const other = await registerOwner('perm-tenant-b');
    const foreignMember = await getAuth(
      `/companies/members/${other.userId}/permissions`,
      owner.accessToken,
    );
    const foreignWrite = await putAuth(
      `/companies/members/${other.userId}/permissions`,
      { permissionKeys: ['tenant.read'] },
      owner.accessToken,
    );
    const ownTemplates = await getAuth(
      '/companies/permission-templates',
      owner.accessToken,
    );
    const otherTemplates = await getAuth(
      '/companies/permission-templates',
      other.accessToken,
    );

    expect(foreignMember.status).toBe(404);
    expect(foreignMember.body.error).toBe('MEMBERSHIP_NOT_FOUND');
    expect(foreignWrite.status).toBe(404);
    expect((ownTemplates.body.templates as { USER: string[] }).USER).toEqual(
      [...viewerPermissionKeys].sort(),
    );
    expect((otherTemplates.body.templates as { USER: string[] }).USER).toEqual(
      [...viewerPermissionKeys].sort(),
    );
    expect(ownTemplates.body.templates).not.toBe(otherTemplates.body.templates);
    const catalog = ownTemplates.body.catalog as Array<{ key: string }>;
    expect(catalog.map((entry) => entry.key)).toContain('users.read');
    expect(catalog.map((entry) => entry.key)).toContain('dashboard.view');
    expect(catalog.map((entry) => entry.key)).not.toContain(
      'permissions.manage',
    );
  });

  it('allows an admin who still has teams.manage to edit a department and rejects them after that grant is removed', async () => {
    const owner = await registerOwner('perm-route');
    const admin = await memberToken(
      owner.accessToken,
      'ADMIN',
      'perm-route-admin',
    );
    const teams = await getAuth('/teams', owner.accessToken);
    const teamId = (teams.body.items as Array<{ id: string }>)[0]?.id;
    const renamed = await patchAuth(
      `/teams/${teamId}`,
      { name: 'Operação', description: 'Dia a dia' },
      admin.accessToken,
    );
    const current = permissionKeys(
      (await getAuth('/permissions/me', admin.accessToken)).body,
    );
    const revoked = await putAuth(
      `/companies/members/${admin.userId}/permissions`,
      { permissionKeys: current.filter((key) => key !== 'teams.manage') },
      owner.accessToken,
    );
    const blocked = await patchAuth(
      `/teams/${teamId}`,
      { name: 'Bloqueado', description: 'Não' },
      admin.accessToken,
    );

    expect(renamed.status).toBe(200);
    expect(revoked.status).toBe(200);
    expect(blocked.status).toBe(403);
    expect(blocked.body.error).toBe('FORBIDDEN');
  });
});
