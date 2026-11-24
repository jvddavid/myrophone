import { getPrisma } from '../../core/db/prisma';
import { AppError } from '../../core/errors/app-error';
import { asType } from './db-types';
import { normalizeName } from './input-rules';
import { hashPassword } from './password';
import { normalizePhone } from './phone';
import type { RequestMeta } from './request-meta';
import { resolveTenantRoleId } from './tenant-bootstrap';

export function ensureCompanyOwner(auth: { role: string | null }): void {
  if (auth.role !== 'OWNER') {
    throw new AppError({
      statusCode: 403,
      code: 'NOT_COMPANY_OWNER',
      message: 'Only the company owner can manage access.',
    });
  }
}

export async function assertTenantOwner(
  userId: string,
  tenantId: string,
): Promise<void> {
  const prisma = await getPrisma();
  const membership = asType<{ id: string } | null>(
    await prisma.membership.findFirst({
      where: {
        userId,
        tenantId,
        status: 'ACTIVE',
        role: { name: 'OWNER' },
      },
      select: { id: true },
    }),
  );

  if (!membership) {
    throw new AppError({
      statusCode: 403,
      code: 'NOT_COMPANY_OWNER',
      message: 'Only the company owner can manage this company.',
    });
  }
}

export async function inviteCompanyMember(
  input: { tenantId: string; actorUserId: string; email: string },
  requestMeta: RequestMeta,
): Promise<{
  userId: string;
  email: string;
  name: string;
  role: 'USER';
  membershipId: string;
}> {
  const email = input.email.trim().toLowerCase();
  const prisma = await getPrisma();

  return prisma.$transaction(async (transaction) => {
    const user = asType<{
      id: string;
      email: string;
      name: string;
      isActive: boolean;
    } | null>(
      await transaction.user.findUnique({
        where: { email },
        select: { id: true, email: true, name: true, isActive: true },
      }),
    );

    if (!user) {
      throw new AppError({
        statusCode: 404,
        code: 'USER_NOT_REGISTERED',
        message: 'No account exists for this email. Create the access instead.',
      });
    }

    if (!user.isActive) {
      throw new AppError({
        statusCode: 403,
        code: 'USER_DISABLED',
        message: 'This account is disabled.',
      });
    }

    const existing = asType<{ id: string } | null>(
      await transaction.membership.findUnique({
        where: {
          tenantId_userId: { tenantId: input.tenantId, userId: user.id },
        },
        select: { id: true },
      }),
    );

    if (existing) {
      throw new AppError({
        statusCode: 409,
        code: 'ALREADY_IN_COMPANY',
        message: 'This person already belongs to this company.',
      });
    }

    const roleId = await resolveTenantRoleId(
      transaction,
      input.tenantId,
      'USER',
    );
    const membership = asType<{ id: string }>(
      await transaction.membership.create({
        data: {
          tenantId: input.tenantId,
          userId: user.id,
          roleId,
          status: 'ACTIVE',
        },
        select: { id: true },
      }),
    );

    await transaction.actionLog.create({
      data: {
        tenantId: input.tenantId,
        actorUserId: input.actorUserId,
        action: 'members.invite',
        entityType: 'membership',
        entityId: membership.id,
        metadata: { userId: user.id, email: user.email },
        ipAddress: requestMeta.ipAddress,
        userAgent: requestMeta.userAgent,
      },
    });

    return {
      userId: user.id,
      email: user.email,
      name: user.name,
      role: 'USER',
      membershipId: membership.id,
    };
  });
}

export async function createCompanyAccess(
  input: {
    actorUserId: string;
    name: string;
    phone: string;
    email: string;
    password: string;
    companies: Array<{ tenantId: string; teamId: string }>;
  },
  requestMeta: RequestMeta,
): Promise<{
  user: { id: string; name: string; email: string; phone: string };
  memberships: Array<{
    tenantId: string;
    membershipId: string;
    role: 'USER';
    team: { id: string; name: string; slug: string };
  }>;
}> {
  const tenantIds = input.companies.map((company) => company.tenantId);
  if (new Set(tenantIds).size !== tenantIds.length) {
    throw new AppError({
      statusCode: 400,
      code: 'DUPLICATE_COMPANY',
      message: 'Each company can appear only once.',
    });
  }

  const name = normalizeName(input.name, 'Name');
  const phone = normalizePhone(input.phone);
  const email = input.email.trim().toLowerCase();
  const passwordHash = await hashPassword(input.password);
  const prisma = await getPrisma();

  return prisma.$transaction(async (transaction) => {
    const owned = asType<Array<{ tenantId: string }>>(
      await transaction.membership.findMany({
        where: {
          userId: input.actorUserId,
          status: 'ACTIVE',
          tenantId: { in: tenantIds },
          role: { name: 'OWNER' },
        },
        select: { tenantId: true },
      }),
    );

    if (owned.length !== tenantIds.length) {
      throw new AppError({
        statusCode: 403,
        code: 'COMPANY_NOT_OWNED',
        message: 'You can only add this person to a company you own.',
      });
    }

    const teams = asType<
      Array<{ id: string; tenantId: string; name: string; slug: string }>
    >(
      await transaction.team.findMany({
        where: {
          isActive: true,
          OR: input.companies.map((company) => ({
            id: company.teamId,
            tenantId: company.tenantId,
          })),
        },
        select: { id: true, tenantId: true, name: true, slug: true },
      }),
    );
    const teamByPair = new Map(
      teams.map((team) => [`${team.tenantId}:${team.id}`, team]),
    );

    if (
      input.companies.some(
        (company) => !teamByPair.has(`${company.tenantId}:${company.teamId}`),
      )
    ) {
      throw new AppError({
        statusCode: 400,
        code: 'TEAM_NOT_IN_COMPANY',
        message: 'The department does not belong to this company.',
      });
    }

    const existingUser = asType<{ id: string } | null>(
      await transaction.user.findUnique({
        where: { email },
        select: { id: true },
      }),
    );

    if (existingUser) {
      throw new AppError({
        statusCode: 409,
        code: 'EMAIL_IN_USE',
        message: 'Email is already in use.',
      });
    }

    const user = asType<{
      id: string;
      name: string;
      email: string;
      phone: string;
    }>(
      await transaction.user.create({
        data: { email, name, phone, passwordHash, isActive: true },
        select: { id: true, name: true, email: true, phone: true },
      }),
    );

    const memberships: Array<{
      tenantId: string;
      membershipId: string;
      role: 'USER';
      team: { id: string; name: string; slug: string };
    }> = [];
    for (const company of input.companies) {
      const team = teamByPair.get(`${company.tenantId}:${company.teamId}`);
      if (!team) {
        throw new AppError({
          statusCode: 400,
          code: 'TEAM_NOT_IN_COMPANY',
          message: 'The department does not belong to this company.',
        });
      }
      const roleId = await resolveTenantRoleId(
        transaction,
        company.tenantId,
        'USER',
      );
      const membership = asType<{ id: string }>(
        await transaction.membership.create({
          data: {
            tenantId: company.tenantId,
            userId: user.id,
            roleId,
            status: 'ACTIVE',
          },
          select: { id: true },
        }),
      );
      await transaction.teamMembership.create({
        data: {
          teamId: team.id,
          membershipId: membership.id,
          role: 'MEMBER',
        },
      });
      await transaction.actionLog.create({
        data: {
          tenantId: company.tenantId,
          teamId: team.id,
          actorUserId: input.actorUserId,
          action: 'members.create',
          entityType: 'membership',
          entityId: membership.id,
          metadata: { userId: user.id, email: user.email, teamId: team.id },
          ipAddress: requestMeta.ipAddress,
          userAgent: requestMeta.userAgent,
        },
      });
      memberships.push({
        tenantId: company.tenantId,
        membershipId: membership.id,
        role: 'USER',
        team: { id: team.id, name: team.name, slug: team.slug },
      });
    }

    return { user, memberships };
  });
}

function activeMemberTeams(
  links: Array<{
    team: { id: string; name: string; slug: string; isActive: boolean };
  }>,
): Array<{ id: string; name: string; slug: string }> {
  const teams: Array<{ id: string; name: string; slug: string }> = [];

  for (const link of links) {
    if (!link.team.isActive) {
      continue;
    }

    teams.push({
      id: link.team.id,
      name: link.team.name,
      slug: link.team.slug,
    });
  }

  return teams;
}

const defaultMemberPageSize = 20;
const maxMemberPageSize = 50;

export interface MemberListInput {
  q?: string;
  page?: number;
  pageSize?: number;
  unassigned?: boolean;
}

export interface CompanyMemberRecord {
  userId: string;
  name: string;
  email: string;
  phone: string;
  avatarUrl: string | null;
  role: string;
  team: { id: string; name: string; slug: string } | null;
  teams: Array<{ id: string; name: string; slug: string }>;
}

export interface MemberListPage {
  members: CompanyMemberRecord[];
  page: number;
  pageSize: number;
  total: number;
}

interface MemberScope {
  teamId?: string;
  outsideTeamId?: string;
  unassigned?: boolean;
}

interface MembershipListRow {
  user: {
    id: string;
    name: string;
    email: string;
    phone: string;
    avatarUrl: string | null;
  };
  role: { name: string };
  teams: Array<{
    team: { id: string; name: string; slug: string; isActive: boolean };
  }>;
}

function memberPageWindow(input: MemberListInput): {
  page: number;
  pageSize: number;
} {
  const page =
    typeof input.page === 'number' && input.page >= 1
      ? Math.floor(input.page)
      : 1;
  const requested =
    typeof input.pageSize === 'number' && input.pageSize >= 1
      ? Math.floor(input.pageSize)
      : defaultMemberPageSize;

  return {
    page,
    pageSize: Math.min(maxMemberPageSize, requested),
  };
}

function memberSearchFilter(q: string | undefined): Record<string, unknown> | null {
  const term = q?.trim();

  if (!term) {
    return null;
  }

  return {
    OR: [
      { user: { name: { contains: term, mode: 'insensitive' } } },
      { user: { email: { contains: term, mode: 'insensitive' } } },
    ],
  };
}

function memberWhere(
  tenantId: string,
  q: string | undefined,
  scope: MemberScope,
): Record<string, unknown> {
  const filters: Array<Record<string, unknown>> = [
    { tenantId, status: 'ACTIVE' },
  ];
  const search = memberSearchFilter(q);

  if (search) {
    filters.push(search);
  }

  if (scope.teamId) {
    filters.push({
      teams: { some: { teamId: scope.teamId, team: { isActive: true } } },
    });
  }

  if (scope.outsideTeamId) {
    filters.push({ teams: { none: { teamId: scope.outsideTeamId } } });
  }

  if (scope.unassigned) {
    filters.push({ teams: { none: { team: { isActive: true } } } });
  }

  return { AND: filters };
}

function toCompanyMember(membership: MembershipListRow): CompanyMemberRecord {
  const teams = activeMemberTeams(membership.teams);

  return {
    userId: membership.user.id,
    name: membership.user.name,
    email: membership.user.email,
    phone: membership.user.phone,
    avatarUrl: membership.user.avatarUrl,
    role: membership.role.name,
    team: teams[0] ?? null,
    teams,
  };
}

const memberListSelect = {
  user: {
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      avatarUrl: true,
    },
  },
  role: { select: { name: true } },
  teams: {
    select: {
      createdAt: true,
      team: {
        select: { id: true, name: true, slug: true, isActive: true },
      },
    },
    orderBy: { createdAt: 'asc' as const },
  },
};

async function requireActiveTeam(
  tenantId: string,
  teamId: string,
): Promise<void> {
  const prisma = await getPrisma();
  const team = asType<{ id: string } | null>(
    await prisma.team.findFirst({
      where: { id: teamId, tenantId, isActive: true },
      select: { id: true },
    }),
  );

  if (!team) {
    throw new AppError({
      statusCode: 404,
      code: 'TEAM_NOT_FOUND',
      message: 'Team not found for this tenant.',
    });
  }
}

async function listScopedMembers(
  tenantId: string,
  input: MemberListInput,
  scope: MemberScope,
): Promise<MemberListPage> {
  const prisma = await getPrisma();
  const { page, pageSize } = memberPageWindow(input);
  const where = memberWhere(tenantId, input.q, scope);
  const [total, memberships] = await Promise.all([
    prisma.membership.count({ where }),
    prisma.membership.findMany({
      where,
      select: memberListSelect,
      orderBy: [
        { user: { name: 'asc' } },
        { user: { email: 'asc' } },
        { userId: 'asc' },
      ],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  return {
    members: asType<MembershipListRow[]>(memberships).map(toCompanyMember),
    page,
    pageSize,
    total: asType<number>(total),
  };
}

export async function listCompanyMembers(
  tenantId: string,
  input: MemberListInput = {},
): Promise<MemberListPage> {
  return listScopedMembers(tenantId, input, {
    unassigned: input.unassigned === true,
  });
}

export async function listTeamMembers(
  tenantId: string,
  teamId: string,
  input: MemberListInput = {},
): Promise<MemberListPage> {
  await requireActiveTeam(tenantId, teamId);
  return listScopedMembers(tenantId, input, { teamId });
}

export async function listTeamCandidates(
  tenantId: string,
  teamId: string,
  input: MemberListInput = {},
): Promise<MemberListPage> {
  await requireActiveTeam(tenantId, teamId);
  return listScopedMembers(tenantId, input, { outsideTeamId: teamId });
}

export async function removeCompanyMember(
  input: { tenantId: string; actorUserId: string; targetUserId: string },
  requestMeta: RequestMeta,
): Promise<{ removed: true }> {
  const prisma = await getPrisma();

  return prisma.$transaction(async (transaction) => {
    const membership = asType<{
      id: string;
      status: string;
      role: { name: string };
      user: { id: string; email: string };
    } | null>(
      await transaction.membership.findUnique({
        where: {
          tenantId_userId: {
            tenantId: input.tenantId,
            userId: input.targetUserId,
          },
        },
        select: {
          id: true,
          status: true,
          role: { select: { name: true } },
          user: { select: { id: true, email: true } },
        },
      }),
    );

    if (!membership) {
      throw new AppError({
        statusCode: 404,
        code: 'MEMBERSHIP_NOT_FOUND',
        message: 'This person does not belong to this company.',
      });
    }

    if (membership.status === 'ACTIVE' && membership.role.name === 'OWNER') {
      const ownerCount = asType<number>(
        await transaction.membership.count({
          where: {
            tenantId: input.tenantId,
            status: 'ACTIVE',
            role: { name: 'OWNER' },
          },
        }),
      );

      if (ownerCount <= 1) {
        throw new AppError({
          statusCode: 409,
          code: 'LAST_OWNER',
          message: 'The last owner of this company cannot be removed.',
        });
      }
    }

    await transaction.actionLog.create({
      data: {
        tenantId: input.tenantId,
        actorUserId: input.actorUserId,
        action: 'members.remove',
        entityType: 'membership',
        entityId: membership.id,
        metadata: { userId: membership.user.id, email: membership.user.email },
        ipAddress: requestMeta.ipAddress,
        userAgent: requestMeta.userAgent,
      },
    });

    await transaction.membership.delete({ where: { id: membership.id } });
    return { removed: true };
  });
}

export async function assignCompanyMemberTeam(
  input: {
    tenantId: string;
    actorUserId: string;
    targetUserId: string;
    teamId: string;
  },
  requestMeta: RequestMeta,
): Promise<{ userId: string; teamId: string; role: 'LEADER' | 'MEMBER' }> {
  const prisma = await getPrisma();

  return prisma.$transaction(async (transaction) => {
    const membership = asType<{
      id: string;
      status: string;
      teams: Array<{ teamId: string; role: 'LEADER' | 'MEMBER' }>;
    } | null>(
      await transaction.membership.findUnique({
        where: {
          tenantId_userId: {
            tenantId: input.tenantId,
            userId: input.targetUserId,
          },
        },
        select: {
          id: true,
          status: true,
          teams: { select: { teamId: true, role: true } },
        },
      }),
    );

    if (!membership || membership.status !== 'ACTIVE') {
      throw new AppError({
        statusCode: 404,
        code: 'MEMBERSHIP_NOT_FOUND',
        message: 'This person does not belong to this company.',
      });
    }

    const team = asType<{ id: string } | null>(
      await transaction.team.findFirst({
        where: { id: input.teamId, tenantId: input.tenantId, isActive: true },
        select: { id: true },
      }),
    );

    if (!team) {
      throw new AppError({
        statusCode: 400,
        code: 'TEAM_NOT_IN_COMPANY',
        message: 'The department does not belong to this company.',
      });
    }

    const currentTeam = membership.teams[0];
    if (
      membership.teams.length === 1 &&
      currentTeam &&
      currentTeam.teamId === team.id
    ) {
      return {
        userId: input.targetUserId,
        teamId: team.id,
        role: currentTeam.role,
      };
    }

    for (const current of membership.teams) {
      if (current.teamId === team.id || current.role !== 'LEADER') {
        continue;
      }
      const leaderCount = asType<number>(
        await transaction.teamMembership.count({
          where: { teamId: current.teamId, role: 'LEADER' },
        }),
      );
      if (leaderCount <= 1) {
        throw new AppError({
          statusCode: 400,
          code: 'LAST_TEAM_LEADER',
          message:
            'This person is the last leader of their current department.',
        });
      }
    }

    const previousTeamIds = membership.teams.map((current) => current.teamId);
    await transaction.teamMembership.deleteMany({
      where: { membershipId: membership.id },
    });
    await transaction.teamMembership.create({
      data: { teamId: team.id, membershipId: membership.id, role: 'MEMBER' },
    });
    await transaction.actionLog.create({
      data: {
        tenantId: input.tenantId,
        teamId: team.id,
        actorUserId: input.actorUserId,
        action: 'members.team_assign',
        entityType: 'membership',
        entityId: membership.id,
        metadata: { userId: input.targetUserId, previousTeamIds },
        ipAddress: requestMeta.ipAddress,
        userAgent: requestMeta.userAgent,
      },
    });

    return { userId: input.targetUserId, teamId: team.id, role: 'MEMBER' };
  });
}

export async function listOwnedCompanies(actorUserId: string): Promise<
  Array<{
    id: string;
    slug: string;
    name: string;
    description: string | null;
    logoUrl: string | null;
    teams: Array<{ id: string; slug: string; name: string }>;
  }>
> {
  const prisma = await getPrisma();
  const memberships = asType<
    Array<{
      tenant: {
        id: string;
        slug: string;
        name: string;
        description: string | null;
        logoUrl: string | null;
        teams: Array<{ id: string; slug: string; name: string }>;
      };
    }>
  >(
    await prisma.membership.findMany({
      where: {
        userId: actorUserId,
        status: 'ACTIVE',
        role: { name: 'OWNER' },
      },
      select: {
        tenant: {
          select: {
            id: true,
            slug: true,
            name: true,
            description: true,
            logoUrl: true,
            teams: {
              where: { isActive: true },
              select: { id: true, slug: true, name: true },
              orderBy: { name: 'asc' },
            },
          },
        },
      },
      orderBy: { tenant: { name: 'asc' } },
    }),
  );

  return memberships.map((membership) => membership.tenant);
}
