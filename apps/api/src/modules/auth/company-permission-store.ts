import { getPrisma } from '../../core/db/prisma';
import { AppError } from '../../core/errors/app-error';
import {
  assertAssignableGrantKeys,
  assignableCatalog,
  type CatalogEntry,
  effectivePermissionKeys,
  factoryTemplateKeys,
  grantsAllow,
} from './company-permissions';
import { asType, type PrismaDb } from './db-types';
import { permissionCatalog, teamPermissionCatalog } from './rbac';
import type { RequestMeta } from './request-meta';

const templateRoles = ['ADMIN', 'USER'] as const;
type TemplateRole = (typeof templateRoles)[number];

function isTemplateRole(role: string): role is TemplateRole {
  return role === 'ADMIN' || role === 'USER';
}

function sorted(keys: Iterable<string>): string[] {
  return [...new Set(keys)].sort((left, right) => left.localeCompare(right));
}

export function fullPermissionKeys(): string[] {
  return sorted([
    ...permissionCatalog.map((item) => item.key),
    ...teamPermissionCatalog.map((item) => item.key),
  ]);
}

export async function seedCompanyPermissionTemplates(
  db: PrismaDb,
  tenantId: string,
): Promise<void> {
  const existing = asType<number>(
    await db.companyPermissionTemplate.count({ where: { tenantId } }),
  );

  if (existing > 0) {
    return;
  }

  await db.companyPermissionTemplate.createMany({
    data: templateRoles.flatMap((role) =>
      factoryTemplateKeys(role).map((permissionKey) => ({
        tenantId,
        role,
        permissionKey,
      })),
    ),
    skipDuplicates: true,
  });
}

export async function copyRoleTemplateGrants(
  db: PrismaDb,
  input: { tenantId: string; membershipId: string; role: string },
): Promise<void> {
  if (!isTemplateRole(input.role)) {
    return;
  }

  const rows = asType<Array<{ permissionKey: string }>>(
    await db.companyPermissionTemplate.findMany({
      where: { tenantId: input.tenantId, role: input.role },
      select: { permissionKey: true },
    }),
  );

  if (rows.length === 0) {
    return;
  }

  await db.membershipPermissionGrant.createMany({
    data: rows.map((row) => ({
      membershipId: input.membershipId,
      permissionKey: row.permissionKey,
    })),
    skipDuplicates: true,
  });
}

interface GrantMembership {
  id: string;
  tenantId: string;
  role: { name: string };
  permissionGrants: Array<{ permissionKey: string }>;
}

async function findGrantMembership(
  db: PrismaDb,
  tenantId: string,
  userId: string,
): Promise<GrantMembership | null> {
  return asType<GrantMembership | null>(
    await db.membership.findUnique({
      where: { tenantId_userId: { tenantId, userId } },
      select: {
        id: true,
        tenantId: true,
        role: { select: { name: true } },
        permissionGrants: { select: { permissionKey: true } },
      },
    }),
  );
}

export async function membershipAllows(
  db: PrismaDb,
  userId: string,
  tenantId: string,
  permissionKey: string,
): Promise<boolean> {
  const membership = await findGrantMembership(db, tenantId, userId);

  if (!membership) {
    return false;
  }

  return grantsAllow(
    membership.role.name,
    membership.permissionGrants.map((grant) => grant.permissionKey),
    permissionKey,
  );
}

export async function assertTenantPermission(
  userId: string,
  tenantId: string,
  permissionKey: string,
): Promise<void> {
  const prisma = await getPrisma();
  const allowed = await membershipAllows(
    prisma,
    userId,
    tenantId,
    permissionKey,
  );

  if (!allowed) {
    throw new AppError({
      statusCode: 403,
      code: 'FORBIDDEN',
      message: `Permission '${permissionKey}' is required.`,
    });
  }
}

export async function readCompanyTemplates(tenantId: string): Promise<{
  templates: { ADMIN: string[]; USER: string[] };
  catalog: CatalogEntry[];
}> {
  const prisma = await getPrisma();
  const rows = asType<Array<{ role: string; permissionKey: string }>>(
    await prisma.companyPermissionTemplate.findMany({
      where: { tenantId, role: { in: ['ADMIN', 'USER'] } },
      select: { role: true, permissionKey: true },
    }),
  );
  const templates = {
    ADMIN: [] as string[],
    USER: [] as string[],
  };

  for (const row of rows) {
    if (isTemplateRole(row.role)) {
      templates[row.role].push(row.permissionKey);
    }
  }

  templates.ADMIN.sort((left, right) => left.localeCompare(right));
  templates.USER.sort((left, right) => left.localeCompare(right));

  return { templates, catalog: assignableCatalog() };
}

export async function replaceCompanyTemplate(
  input: {
    tenantId: string;
    actorUserId: string;
    role: string;
    permissionKeys: string[];
  },
  requestMeta: RequestMeta,
): Promise<{ role: TemplateRole; permissionKeys: string[] }> {
  if (!isTemplateRole(input.role)) {
    throw new AppError({
      statusCode: 400,
      code: 'INVALID_TEMPLATE_ROLE',
      message: 'Only the admin and user templates can be edited.',
    });
  }

  assertAssignableGrantKeys(input.permissionKeys);
  const permissionKeys = sorted(input.permissionKeys);
  const prisma = await getPrisma();

  await prisma.$transaction(async (transaction) => {
    await transaction.companyPermissionTemplate.deleteMany({
      where: { tenantId: input.tenantId, role: input.role },
    });

    if (permissionKeys.length > 0) {
      await transaction.companyPermissionTemplate.createMany({
        data: permissionKeys.map((permissionKey) => ({
          tenantId: input.tenantId,
          role: input.role,
          permissionKey,
        })),
      });
    }

    await transaction.actionLog.create({
      data: {
        tenantId: input.tenantId,
        actorUserId: input.actorUserId,
        action: 'permissions.template_update',
        entityType: 'tenant',
        entityId: input.tenantId,
        metadata: { role: input.role, permissionKeys },
        ipAddress: requestMeta.ipAddress,
        userAgent: requestMeta.userAgent,
      },
    });
  });

  return { role: input.role, permissionKeys };
}

export async function readMemberPermissions(
  tenantId: string,
  userId: string,
): Promise<{
  userId: string;
  role: string;
  locked: boolean;
  permissionKeys: string[];
}> {
  const prisma = await getPrisma();
  const membership = await findGrantMembership(prisma, tenantId, userId);

  if (!membership || membership.tenantId !== tenantId) {
    throw new AppError({
      statusCode: 404,
      code: 'MEMBERSHIP_NOT_FOUND',
      message: 'This person does not belong to this company.',
    });
  }

  const effective = effectivePermissionKeys({
    role: membership.role.name,
    grants: membership.permissionGrants.map((grant) => grant.permissionKey),
  });

  return {
    userId,
    role: membership.role.name,
    locked: membership.role.name === 'OWNER',
    permissionKeys: sorted([
      ...effective.permissions,
      ...effective.teamPermissions,
    ]),
  };
}

export async function replaceMemberPermissions(
  input: {
    tenantId: string;
    actorUserId: string;
    targetUserId: string;
    permissionKeys: string[];
  },
  requestMeta: RequestMeta,
): Promise<{ userId: string; permissionKeys: string[] }> {
  assertAssignableGrantKeys(input.permissionKeys);
  const permissionKeys = sorted(input.permissionKeys);
  const prisma = await getPrisma();

  return prisma.$transaction(async (transaction) => {
    const membership = await findGrantMembership(
      transaction,
      input.tenantId,
      input.targetUserId,
    );

    if (!membership || membership.tenantId !== input.tenantId) {
      throw new AppError({
        statusCode: 404,
        code: 'MEMBERSHIP_NOT_FOUND',
        message: 'This person does not belong to this company.',
      });
    }

    if (membership.role.name === 'OWNER') {
      throw new AppError({
        statusCode: 409,
        code: 'OWNER_PERMISSIONS_LOCKED',
        message: 'The company owner always has full access.',
      });
    }

    await transaction.membershipPermissionGrant.deleteMany({
      where: { membershipId: membership.id },
    });

    if (permissionKeys.length > 0) {
      await transaction.membershipPermissionGrant.createMany({
        data: permissionKeys.map((permissionKey) => ({
          membershipId: membership.id,
          permissionKey,
        })),
      });
    }

    await transaction.actionLog.create({
      data: {
        tenantId: input.tenantId,
        actorUserId: input.actorUserId,
        action: 'permissions.member_update',
        entityType: 'membership',
        entityId: membership.id,
        metadata: { userId: input.targetUserId, permissionKeys },
        ipAddress: requestMeta.ipAddress,
        userAgent: requestMeta.userAgent,
      },
    });

    return { userId: input.targetUserId, permissionKeys };
  });
}
