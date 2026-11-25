import { seedCompanyPermissionTemplates } from './company-permission-store';
import { asType, type PrismaDb } from './db-types';
import {
  type AppRoleName,
  roleDescriptionMap,
  rolePermissionMap,
  teamPermissionCatalog,
} from './rbac';

export async function ensurePermissionCatalog(db: PrismaDb): Promise<void> {
  const permissions = Object.entries(rolePermissionMap)
    .flatMap(([, keys]) => keys)
    .reduce<Map<string, true>>((accumulator, key) => {
      accumulator.set(key, true);
      return accumulator;
    }, new Map());

  const permissionData = Array.from(permissions.keys()).map((key) => ({
    key,
    description: key,
  }));

  await db.permission.createMany({
    data: permissionData,
    skipDuplicates: true,
  });
}

export async function ensureTeamPermissionCatalog(db: PrismaDb): Promise<void> {
  await db.teamPermission.createMany({
    data: teamPermissionCatalog.map((item) => ({
      key: item.key,
      description: item.description,
    })),
    skipDuplicates: true,
  });
}

export async function ensureTenantRbac(
  db: PrismaDb,
  tenantId: string,
): Promise<Record<AppRoleName, string>> {
  await ensurePermissionCatalog(db);
  await ensureTeamPermissionCatalog(db);

  const roleIds = {} as Record<AppRoleName, string>;

  for (const [roleName, permissionKeys] of Object.entries(
    rolePermissionMap,
  ) as [AppRoleName, readonly string[]][]) {
    const role = asType<{ id: string }>(
      await db.role.upsert({
        where: {
          tenantId_name: {
            tenantId,
            name: roleName,
          },
        },
        update: {
          description: roleDescriptionMap[roleName],
        },
        create: {
          tenantId,
          name: roleName,
          description: roleDescriptionMap[roleName],
          isSystem: true,
        },
      }),
    );

    roleIds[roleName] = role.id;

    const permissions = asType<Array<{ id: string; key: string }>>(
      await db.permission.findMany({
        where: {
          key: {
            in: [...permissionKeys],
          },
        },
        select: {
          id: true,
          key: true,
        },
      }),
    );

    const permissionIdByKey = new Map(
      permissions.map((item) => [item.key, item.id]),
    );

    await db.rolePermission.deleteMany({
      where: {
        roleId: role.id,
      },
    });

    await db.rolePermission.createMany({
      data: permissionKeys
        .map((key) => permissionIdByKey.get(key))
        .filter((permissionId): permissionId is string => !!permissionId)
        .map((permissionId) => ({
          roleId: role.id,
          permissionId,
        })),
      skipDuplicates: true,
    });
  }

  await seedCompanyPermissionTemplates(db, tenantId);

  return roleIds;
}

export async function resolveTenantRoleId(
  db: PrismaDb,
  tenantId: string,
  roleName: AppRoleName,
): Promise<string> {
  const roleIds = await ensureTenantRbac(db, tenantId);
  return roleIds[roleName];
}
