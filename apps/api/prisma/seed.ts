/// <reference types="bun" />

import { normalizeTenantId } from '@myrophone/shared';
import type { PrismaDb } from '../src/modules/auth/db-types';
import { hashPassword } from '../src/modules/auth/password';
import { ensureTenantRbac } from '../src/modules/auth/tenant-bootstrap';

type PrismaClientConstructor = new (options?: {
  adapter?: unknown;
}) => PrismaDb;

type PrismaPgConstructor = new (options: {
  connectionString: string;
}) => unknown;

function isPrismaModule(
  value: unknown,
): value is { PrismaClient?: PrismaClientConstructor } {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as { PrismaClient?: unknown };

  if (candidate.PrismaClient === undefined) {
    return true;
  }

  return typeof candidate.PrismaClient === 'function';
}

function isPrismaAdapterPgModule(
  value: unknown,
): value is { PrismaPg?: PrismaPgConstructor } {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as { PrismaPg?: unknown };

  if (candidate.PrismaPg === undefined) {
    return true;
  }

  return typeof candidate.PrismaPg === 'function';
}

function normalizeTenantSlug(value: string): string {
  const clean = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  return normalizeTenantId(clean || value);
}

function resolveDatabaseUrl(): string {
  return (
    Bun.env.DATABASE_URL ??
    'postgresql://postgres:postgres@localhost:5432/myrophone?schema=public'
  );
}

async function createPrismaClient(): Promise<PrismaDb> {
  const prismaClientModuleName = '@prisma/client';
  const prismaAdapterPgModuleName = ['@prisma', 'adapter-pg'].join('/');

  const [prismaModuleUnknown, prismaAdapterPgModuleUnknown]: [
    unknown,
    unknown,
  ] = await Promise.all([
    import(prismaClientModuleName),
    import(prismaAdapterPgModuleName),
  ]);

  if (
    !isPrismaModule(prismaModuleUnknown) ||
    !prismaModuleUnknown.PrismaClient
  ) {
    throw new Error(
      "Prisma Client is not generated. Run 'bun run --cwd apps/api prisma:generate'.",
    );
  }

  if (
    !isPrismaAdapterPgModule(prismaAdapterPgModuleUnknown) ||
    !prismaAdapterPgModuleUnknown.PrismaPg
  ) {
    throw new Error(
      "Prisma PostgreSQL adapter is not available. Install '@prisma/adapter-pg'.",
    );
  }

  const adapter = new prismaAdapterPgModuleUnknown.PrismaPg({
    connectionString: resolveDatabaseUrl(),
  });

  return new prismaModuleUnknown.PrismaClient({ adapter });
}

async function main(): Promise<void> {
  const prisma = await createPrismaClient();

  const tenantName = Bun.env.SEED_TENANT_NAME ?? 'MyroPhone Demo Tenant';
  const tenantSlug = normalizeTenantSlug(
    Bun.env.SEED_TENANT_SLUG ?? tenantName,
  );

  const ownerEmail = Bun.env.SEED_OWNER_EMAIL;
  const ownerPassword = Bun.env.SEED_OWNER_PASSWORD;
  const ownerName = Bun.env.SEED_OWNER_NAME ?? 'Owner';

  try {
    const tenant = (await prisma.tenant.upsert({
      where: {
        slug: tenantSlug,
      },
      update: {
        name: tenantName,
      },
      create: {
        name: tenantName,
        slug: tenantSlug,
      },
    })) as { id: string; slug: string };

    const roleIds = await ensureTenantRbac(prisma, tenant.id);

    const defaultTeam = (await prisma.team.upsert({
      where: {
        tenantId_slug: {
          tenantId: tenant.id,
          slug: 'geral',
        },
      },
      update: {
        isActive: true,
      },
      create: {
        tenantId: tenant.id,
        slug: 'geral',
        name: 'Geral',
        isActive: true,
      },
    })) as { id: string; slug: string };

    if (!ownerEmail || !ownerPassword) {
      console.log(
        '[seed] Tenant RBAC initialized. Define SEED_OWNER_EMAIL and SEED_OWNER_PASSWORD to create default owner user.',
      );
      return;
    }

    const owner = (await prisma.user.upsert({
      where: {
        email: ownerEmail.trim().toLowerCase(),
      },
      update: {
        name: ownerName,
        passwordHash: await hashPassword(ownerPassword),
        isActive: true,
      },
      create: {
        name: ownerName,
        email: ownerEmail.trim().toLowerCase(),
        passwordHash: await hashPassword(ownerPassword),
        isActive: true,
      },
    })) as { id: string; email: string };

    const membership = (await prisma.membership.upsert({
      where: {
        tenantId_userId: {
          tenantId: tenant.id,
          userId: owner.id,
        },
      },
      update: {
        roleId: roleIds.OWNER,
        status: 'ACTIVE',
      },
      create: {
        tenantId: tenant.id,
        userId: owner.id,
        roleId: roleIds.OWNER,
        status: 'ACTIVE',
      },
    })) as { id: string };

    await prisma.teamMembership.upsert({
      where: {
        teamId_membershipId: {
          teamId: defaultTeam.id,
          membershipId: membership.id,
        },
      },
      update: {
        role: 'LEADER',
      },
      create: {
        teamId: defaultTeam.id,
        membershipId: membership.id,
        role: 'LEADER',
      },
    });

    console.log(
      `[seed] Tenant '${tenant.slug}', team '${defaultTeam.slug}' and owner '${owner.email}' ready.`,
    );
  } finally {
    if (typeof prisma.$disconnect === 'function') {
      await prisma.$disconnect();
    }
  }
}

main().catch((error) => {
  console.error('[seed] failed', error);
  process.exit(1);
});
