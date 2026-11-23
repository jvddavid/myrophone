import { normalizeTenantId } from '@myrophone/shared';
import { env } from '../../core/config/env';
import { getPrisma } from '../../core/db/prisma';
import { AppError } from '../../core/errors/app-error';
import { chooseActiveTenantId, withSlugSuffix } from './company-selection';
import {
  type ActionLogRecord,
  asType,
  type MembershipWithRelations,
  type PrismaDb,
  type SessionRecord,
  type TeamWithCountsAndPermissions,
  type TeamWithPermissions,
  type UserRecord,
} from './db-types';
import { hashPassword, verifyPassword } from './password';
import { normalizePhone } from './phone';
import {
  type AppRoleName,
  defaultRoleName,
  isTenantAdminRole,
  type TeamPermissionKey,
} from './rbac';
import type { RequestMeta } from './request-meta';
import { ensureTenantRbac, resolveTenantRoleId } from './tenant-bootstrap';
import {
  generateRefreshToken,
  hashOpaqueToken,
  parseBearerToken,
  signAccessToken,
  verifyAccessToken,
} from './token';

type TeamMembershipRoleValue = 'LEADER' | 'MEMBER';

const MEMBERSHIP_ACTIVE = 'ACTIVE';
const DEFAULT_TEAM_SLUG = 'geral';
const DEFAULT_TEAM_NAME = 'Geral';

interface SessionTokenSet {
  sessionId: string;
  accessToken: string;
  refreshToken: string;
  accessTokenTtl: string;
  refreshTokenExpiresAt: string;
}

export interface TeamContextItem {
  id: string;
  slug: string;
  name: string;
  membershipRole: TeamMembershipRoleValue;
  permissionKeys: string[];
}

export interface AuthContext {
  sessionId: string;
  membershipId: string | null;
  user: {
    id: string;
    email: string;
    name: string;
    phone: string;
    avatarUrl: string | null;
    emailVerifiedAt: string | null;
    isActive: boolean;
  };
  tenant: {
    id: string;
    slug: string;
    name: string;
  } | null;
  companies: Array<{
    id: string;
    slug: string;
    name: string;
  }>;
  role: string | null;
  permissions: string[];
  teams: TeamContextItem[];
  teamPermissions: string[];
}

export interface AuthResponse extends AuthContext {
  tokens: {
    accessToken: string;
    refreshToken: string;
    accessTokenTtl: string;
    refreshTokenExpiresAt: string;
  };
}

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

function normalizeSlug(value: string): string {
  const clean = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  return clean;
}

function normalizeTenantSlug(value: string): string {
  return normalizeTenantId(normalizeSlug(value) || value);
}

function normalizeTeamSlug(value: string): string {
  return normalizeSlug(value) || DEFAULT_TEAM_SLUG;
}

function computeRefreshExpiryDate(): Date {
  const result = new Date();
  result.setDate(result.getDate() + env.REFRESH_TOKEN_TTL_DAYS);
  return result;
}

function toUniqueSortedPermissions(
  membership: MembershipWithRelations,
): string[] {
  const permissions = membership.role.permissions.map(
    (item) => item.permission.key,
  );

  return [...new Set(permissions)].sort((a, b) => a.localeCompare(b));
}

function toUniqueSortedTeams(
  membership: MembershipWithRelations,
): TeamContextItem[] {
  const map = new Map<string, TeamContextItem>();

  for (const item of membership.teams ?? []) {
    if (!item?.team) {
      continue;
    }

    const teamPermissionKeys = [
      ...new Set(
        item.team.permissions.map((assignment) => assignment.permission.key),
      ),
    ].sort((a, b) => a.localeCompare(b));

    map.set(item.team.id, {
      id: item.team.id,
      slug: item.team.slug,
      name: item.team.name,
      membershipRole: item.role,
      permissionKeys: teamPermissionKeys,
    });
  }

  return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
}

function collectTeamPermissions(teams: TeamContextItem[]): string[] {
  return [...new Set(teams.flatMap((team) => team.permissionKeys))].sort(
    (a, b) => a.localeCompare(b),
  );
}

interface CompanySummary {
  id: string;
  slug: string;
  name: string;
}

function toPublicUser(user: UserRecord) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    phone: user.phone,
    avatarUrl: user.avatarUrl,
    emailVerifiedAt: user.emailVerifiedAt?.toISOString() ?? null,
    isActive: user.isActive,
  };
}

async function listActiveCompanies(
  db: PrismaDb,
  userId: string,
): Promise<CompanySummary[]> {
  const memberships = asType<
    Array<{ tenant: { id: string; slug: string; name: string } }>
  >(
    await db.membership.findMany({
      where: { userId, status: MEMBERSHIP_ACTIVE },
      include: { tenant: true },
    }),
  );

  return memberships
    .map((membership) => membership.tenant)
    .sort((left, right) => left.name.localeCompare(right.name, 'pt-BR'));
}

function toAccountContext(
  user: UserRecord,
  sessionId: string,
  companies: CompanySummary[],
): AuthContext {
  return {
    sessionId,
    membershipId: null,
    user: toPublicUser(user),
    tenant: null,
    companies,
    role: null,
    permissions: [],
    teams: [],
    teamPermissions: [],
  };
}

function toAuthContext(
  membership: MembershipWithRelations,
  sessionId: string,
  companies: CompanySummary[],
): AuthContext {
  const teams = toUniqueSortedTeams(membership);

  return {
    sessionId,
    membershipId: membership.id,
    user: toPublicUser(membership.user),
    tenant: {
      id: membership.tenant.id,
      slug: membership.tenant.slug,
      name: membership.tenant.name,
    },
    companies,
    role: membership.role.name,
    permissions: toUniqueSortedPermissions(membership),
    teams,
    teamPermissions: collectTeamPermissions(teams),
  };
}

function attachTokens(
  context: AuthContext,
  tokenSet: SessionTokenSet,
): AuthResponse {
  return {
    ...context,
    tokens: {
      accessToken: tokenSet.accessToken,
      refreshToken: tokenSet.refreshToken,
      accessTokenTtl: tokenSet.accessTokenTtl,
      refreshTokenExpiresAt: tokenSet.refreshTokenExpiresAt,
    },
  };
}

function toAuthResponse(
  membership: MembershipWithRelations,
  tokenSet: SessionTokenSet,
  companies: CompanySummary[],
): AuthResponse {
  return attachTokens(
    toAuthContext(membership, tokenSet.sessionId, companies),
    tokenSet,
  );
}

async function findActiveMembership(
  db: PrismaDb,
  userId: string,
  tenantId: string,
): Promise<MembershipWithRelations | null> {
  return asType<MembershipWithRelations | null>(
    await db.membership.findUnique({
      where: {
        tenantId_userId: {
          tenantId,
          userId,
        },
      },
      include: {
        tenant: true,
        user: true,
        role: {
          include: {
            permissions: {
              include: {
                permission: true,
              },
            },
          },
        },
        teams: {
          include: {
            team: {
              include: {
                permissions: {
                  include: {
                    permission: true,
                  },
                },
              },
            },
          },
        },
      },
    }),
  );
}

async function createActionLog(
  db: PrismaDb,
  params: {
    tenantId?: string;
    teamId?: string;
    actorUserId?: string;
    action: string;
    entityType: string;
    entityId?: string;
    metadata?: Record<string, unknown>;
    requestMeta?: RequestMeta;
  },
): Promise<void> {
  await db.actionLog.create({
    data: {
      tenantId: params.tenantId,
      teamId: params.teamId,
      actorUserId: params.actorUserId,
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId,
      metadata: params.metadata,
      ipAddress: params.requestMeta?.ipAddress,
      userAgent: params.requestMeta?.userAgent,
    },
  });
}

async function ensureDefaultTeam(
  db: PrismaDb,
  tenantId: string,
): Promise<{ id: string; slug: string; name: string }> {
  return asType<{ id: string; slug: string; name: string }>(
    await db.team.upsert({
      where: {
        tenantId_slug: {
          tenantId,
          slug: DEFAULT_TEAM_SLUG,
        },
      },
      update: {
        isActive: true,
      },
      create: {
        tenantId,
        slug: DEFAULT_TEAM_SLUG,
        name: DEFAULT_TEAM_NAME,
        isActive: true,
      },
      select: {
        id: true,
        slug: true,
        name: true,
      },
    }),
  );
}

async function resolveTeamIdsForMembership(
  db: PrismaDb,
  tenantId: string,
  requestedTeamIds: string[] | undefined,
): Promise<string[]> {
  if (!requestedTeamIds || requestedTeamIds.length === 0) {
    const defaultTeam = await ensureDefaultTeam(db, tenantId);
    return [defaultTeam.id];
  }

  const uniqueTeamIds = [...new Set(requestedTeamIds)];

  const teams = asType<Array<{ id: string }>>(
    await db.team.findMany({
      where: {
        tenantId,
        isActive: true,
        id: {
          in: uniqueTeamIds,
        },
      },
      select: {
        id: true,
      },
    }),
  );

  if (teams.length !== uniqueTeamIds.length) {
    throw new AppError({
      statusCode: 400,
      code: 'INVALID_TEAM_IDS',
      message: 'One or more teamIds are invalid for this tenant.',
    });
  }

  return teams.map((team) => team.id);
}

async function resolveTeamPermissionIds(
  db: PrismaDb,
  requestedPermissionKeys: TeamPermissionKey[] | undefined,
): Promise<string[]> {
  if (!requestedPermissionKeys || requestedPermissionKeys.length === 0) {
    return [];
  }

  const uniqueKeys = [...new Set(requestedPermissionKeys)];

  const permissions = asType<Array<{ id: string; key: string }>>(
    await db.teamPermission.findMany({
      where: {
        key: {
          in: uniqueKeys,
        },
      },
      select: {
        id: true,
        key: true,
      },
    }),
  );

  if (permissions.length !== uniqueKeys.length) {
    throw new AppError({
      statusCode: 400,
      code: 'INVALID_TEAM_PERMISSION_KEYS',
      message: 'One or more team permission keys are invalid.',
    });
  }

  return permissions.map((permission) => permission.id);
}

async function assignMembershipTeams(
  db: PrismaDb,
  membershipId: string,
  teamIds: string[],
  role: TeamMembershipRoleValue,
): Promise<void> {
  await db.teamMembership.deleteMany({
    where: {
      membershipId,
    },
  });

  await db.teamMembership.createMany({
    data: teamIds.map((teamId) => ({
      membershipId,
      teamId,
      role,
    })),
    skipDuplicates: true,
  });
}

async function assignTeamPermissions(
  db: PrismaDb,
  teamId: string,
  permissionIds: string[],
): Promise<void> {
  await db.teamPermissionAssignment.deleteMany({
    where: {
      teamId,
    },
  });

  if (permissionIds.length === 0) {
    return;
  }

  await db.teamPermissionAssignment.createMany({
    data: permissionIds.map((permissionId) => ({
      teamId,
      permissionId,
    })),
    skipDuplicates: true,
  });
}

function ensureCanManageTeamMembers(
  authContext: AuthContext,
  teamId: string,
): asserts authContext is AuthContext & {
  role: string;
  tenant: CompanySummary;
} {
  if (!authContext.role || !authContext.tenant) {
    throw new AppError({
      statusCode: 403,
      code: 'NO_ACTIVE_TENANT',
      message: 'An active company is required.',
    });
  }

  if (isTenantAdminRole(authContext.role)) {
    return;
  }

  const team = authContext.teams.find((item) => item.id === teamId);

  if (team && team.membershipRole === 'LEADER') {
    return;
  }

  throw new AppError({
    statusCode: 403,
    code: 'TEAM_MEMBER_MANAGEMENT_FORBIDDEN',
    message: 'Only team leaders can manage members for this team.',
  });
}

async function createSessionTokens(
  db: PrismaDb,
  membership: MembershipWithRelations,
  requestMeta: RequestMeta,
): Promise<SessionTokenSet> {
  const refreshToken = generateRefreshToken();
  const refreshTokenHash = await hashOpaqueToken(refreshToken);
  const refreshExpiresAt = computeRefreshExpiryDate();

  const session = asType<SessionRecord>(
    await db.session.create({
      data: {
        userId: membership.user.id,
        tenantId: membership.tenant.id,
        refreshTokenHash,
        expiresAt: refreshExpiresAt,
        ipAddress: requestMeta.ipAddress,
        userAgent: requestMeta.userAgent,
      },
    }),
  );

  const accessToken = await signAccessToken({
    userId: membership.user.id,
    sessionId: session.id,
    tenantId: membership.tenant.id,
    email: membership.user.email,
  });

  return {
    sessionId: session.id,
    accessToken,
    refreshToken,
    accessTokenTtl: env.JWT_ACCESS_TTL,
    refreshTokenExpiresAt: refreshExpiresAt.toISOString(),
  };
}

async function createAccountSessionTokens(
  db: PrismaDb,
  user: UserRecord,
  requestMeta: RequestMeta,
): Promise<{ session: SessionRecord; tokens: SessionTokenSet }> {
  const refreshToken = generateRefreshToken();
  const refreshTokenHash = await hashOpaqueToken(refreshToken);
  const refreshExpiresAt = computeRefreshExpiryDate();

  const session = asType<SessionRecord>(
    await db.session.create({
      data: {
        userId: user.id,
        tenantId: null,
        refreshTokenHash,
        expiresAt: refreshExpiresAt,
        ipAddress: requestMeta.ipAddress,
        userAgent: requestMeta.userAgent,
      },
    }),
  );

  const accessToken = await signAccessToken({
    userId: user.id,
    sessionId: session.id,
    tenantId: null,
    email: user.email,
  });

  return {
    session,
    tokens: {
      sessionId: session.id,
      accessToken,
      refreshToken,
      accessTokenTtl: env.JWT_ACCESS_TTL,
      refreshTokenExpiresAt: refreshExpiresAt.toISOString(),
    },
  };
}

async function reissueAccessToken(
  session: SessionRecord,
  user: { id: string; email: string },
  tenantId: string,
): Promise<SessionTokenSet['accessToken']> {
  return signAccessToken({
    userId: user.id,
    sessionId: session.id,
    tenantId,
    email: user.email,
  });
}

async function assertCurrentRefreshToken(
  session: SessionRecord,
  refreshToken: string,
): Promise<void> {
  const refreshTokenHash = await hashOpaqueToken(refreshToken);

  if (
    session.refreshTokenHash !== refreshTokenHash ||
    session.revokedAt ||
    session.expiresAt.getTime() <= Date.now()
  ) {
    throw new AppError({
      statusCode: 401,
      code: 'INVALID_REFRESH_TOKEN',
      message: 'Refresh token is invalid or already revoked.',
    });
  }
}

export async function createFirstCompany(
  input: {
    userId: string;
    sessionId: string;
    name: string;
    refreshToken: string;
  },
  requestMeta: RequestMeta,
): Promise<AuthResponse> {
  const prisma = await getPrisma();

  const session = asType<SessionRecord | null>(
    await prisma.session.findUnique({
      where: { id: input.sessionId },
    }),
  );

  if (!session || session.userId !== input.userId) {
    throw new AppError({
      statusCode: 401,
      code: 'UNAUTHORIZED',
      message: 'Authentication is required.',
    });
  }

  await assertCurrentRefreshToken(session, input.refreshToken);

  const user = asType<UserRecord | null>(
    await prisma.user.findUnique({ where: { id: input.userId } }),
  );

  if (!user || !user.isActive) {
    throw new AppError({
      statusCode: 403,
      code: 'USER_DISABLED',
      message: 'User is disabled.',
    });
  }

  const name = input.name.trim();

  const result = await prisma.$transaction(async (transaction) => {
    const activeCount = asType<number>(
      await transaction.membership.count({
        where: { userId: user.id, status: MEMBERSHIP_ACTIVE },
      }),
    );

    if (activeCount > 0) {
      throw new AppError({
        statusCode: 403,
        code: 'COMPANY_CREATE_UNAVAILABLE',
        message: 'This account already has an active company.',
      });
    }

    const base = normalizeTenantSlug(name);
    let slug = base;

    for (let attempt = 1; attempt <= 50; attempt += 1) {
      slug = withSlugSuffix(base, attempt);
      const existing = asType<{ id: string } | null>(
        await transaction.tenant.findUnique({
          where: { slug },
          select: { id: true },
        }),
      );

      if (!existing) {
        break;
      }
    }

    const tenant = asType<{ id: string }>(
      await transaction.tenant.create({
        data: { name, slug },
      }),
    );

    const roleIds = await ensureTenantRbac(transaction, tenant.id);

    const membership = asType<{ id: string }>(
      await transaction.membership.create({
        data: {
          tenantId: tenant.id,
          userId: user.id,
          roleId: roleIds.OWNER,
          status: MEMBERSHIP_ACTIVE,
        },
        select: { id: true },
      }),
    );

    const team = asType<{ id: string }>(
      await transaction.team.upsert({
        where: {
          tenantId_slug: {
            tenantId: tenant.id,
            slug: DEFAULT_TEAM_SLUG,
          },
        },
        update: {
          name: DEFAULT_TEAM_NAME,
          isActive: true,
        },
        create: {
          tenantId: tenant.id,
          slug: DEFAULT_TEAM_SLUG,
          name: DEFAULT_TEAM_NAME,
          isActive: true,
        },
        select: { id: true },
      }),
    );

    const permissionIds = await resolveTeamPermissionIds(transaction, []);

    await assignTeamPermissions(transaction, team.id, permissionIds);

    await transaction.teamMembership.upsert({
      where: {
        teamId_membershipId: {
          teamId: team.id,
          membershipId: membership.id,
        },
      },
      update: { role: 'LEADER' },
      create: {
        teamId: team.id,
        membershipId: membership.id,
        role: 'LEADER',
      },
    });

    await transaction.session.update({
      where: { id: session.id },
      data: { tenantId: tenant.id },
    });

    await transaction.user.update({
      where: { id: user.id },
      data: { lastTenantId: tenant.id },
    });

    await createActionLog(transaction, {
      tenantId: tenant.id,
      teamId: team.id,
      actorUserId: user.id,
      action: 'companies.create',
      entityType: 'tenant',
      entityId: tenant.id,
      metadata: {
        email: user.email,
      },
      requestMeta,
    });

    return { tenantId: tenant.id };
  });

  const membership = await findActiveMembership(
    prisma,
    user.id,
    result.tenantId,
  );

  if (!membership) {
    throw new AppError({
      statusCode: 500,
      code: 'MEMBERSHIP_NOT_FOUND',
      message: 'Could not initialize tenant membership.',
    });
  }

  const accessToken = await reissueAccessToken(
    session,
    user,
    result.tenantId,
  );
  const companies = await listActiveCompanies(prisma, user.id);

  return toAuthResponse(
    membership,
    {
      sessionId: session.id,
      accessToken,
      refreshToken: input.refreshToken,
      accessTokenTtl: env.JWT_ACCESS_TTL,
      refreshTokenExpiresAt: session.expiresAt.toISOString(),
    },
    companies,
  );
}

export async function switchCompany(
  input: {
    userId: string;
    sessionId: string;
    tenantId: string;
    refreshToken: string;
  },
  requestMeta: RequestMeta,
): Promise<AuthResponse> {
  const prisma = await getPrisma();

  const session = asType<SessionRecord | null>(
    await prisma.session.findUnique({
      where: { id: input.sessionId },
    }),
  );

  if (!session || session.userId !== input.userId) {
    throw new AppError({
      statusCode: 401,
      code: 'UNAUTHORIZED',
      message: 'Authentication is required.',
    });
  }

  await assertCurrentRefreshToken(session, input.refreshToken);

  const membership = await findActiveMembership(
    prisma,
    input.userId,
    input.tenantId,
  );

  if (!membership || membership.status !== MEMBERSHIP_ACTIVE) {
    throw new AppError({
      statusCode: 403,
      code: 'MEMBERSHIP_NOT_ACTIVE',
      message: 'Membership is not active for this tenant.',
    });
  }

  if (!membership.user.isActive) {
    throw new AppError({
      statusCode: 403,
      code: 'USER_DISABLED',
      message: 'User is disabled.',
    });
  }

  await prisma.session.update({
    where: { id: session.id },
    data: { tenantId: membership.tenantId },
  });

  await prisma.user.update({
    where: { id: membership.user.id },
    data: { lastTenantId: membership.tenantId },
  });

  await createActionLog(prisma, {
    tenantId: membership.tenantId,
    actorUserId: membership.user.id,
    action: 'auth.switch_tenant',
    entityType: 'session',
    entityId: session.id,
    metadata: {
      email: membership.user.email,
      previousTenantId: session.tenantId,
    },
    requestMeta,
  });

  const accessToken = await reissueAccessToken(
    session,
    membership.user,
    membership.tenantId,
  );
  const companies = await listActiveCompanies(prisma, membership.user.id);

  return toAuthResponse(
    membership,
    {
      sessionId: session.id,
      accessToken,
      refreshToken: input.refreshToken,
      accessTokenTtl: env.JWT_ACCESS_TTL,
      refreshTokenExpiresAt: session.expiresAt.toISOString(),
    },
    companies,
  );
}

export async function registerAccount(
  input: {
    name: string;
    phone: string;
    email: string;
    password: string;
  },
  requestMeta: RequestMeta,
): Promise<AuthResponse> {
  if (input.password.length < 8) {
    throw new AppError({
      statusCode: 400,
      code: 'INVALID_PASSWORD',
      message: 'Password must have at least 8 characters.',
    });
  }

  const phone = normalizePhone(input.phone);
  const prisma = await getPrisma();
  const normalizedEmail = normalizeEmail(input.email);

  const existingUser = asType<{ id: string } | null>(
    await prisma.user.findUnique({
      where: { email: normalizedEmail },
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

  const user = asType<UserRecord>(
    await prisma.user.create({
      data: {
        name: input.name.trim(),
        phone,
        email: normalizedEmail,
        passwordHash: await hashPassword(input.password),
        avatarUrl: null,
        emailVerifiedAt: null,
      },
    }),
  );

  const opened = await createAccountSessionTokens(prisma, user, requestMeta);

  await createActionLog(prisma, {
    tenantId: opened.session.tenantId ?? undefined,
    actorUserId: user.id,
    action: 'auth.register',
    entityType: 'user',
    entityId: user.id,
    metadata: {
      email: user.email,
    },
    requestMeta,
  });

  const companies = await listActiveCompanies(prisma, user.id);

  return attachTokens(
    toAccountContext(user, opened.tokens.sessionId, companies),
    opened.tokens,
  );
}

export async function loginWithPassword(
  input: {
    email: string;
    password: string;
  },
  requestMeta: RequestMeta,
): Promise<AuthResponse> {
  const prisma = await getPrisma();

  const user = asType<UserRecord | null>(
    await prisma.user.findUnique({
      where: {
        email: normalizeEmail(input.email),
      },
    }),
  );

  if (!user || !(await verifyPassword(input.password, user.passwordHash))) {
    throw new AppError({
      statusCode: 401,
      code: 'INVALID_CREDENTIALS',
      message: 'Invalid email or password.',
    });
  }

  if (!user.isActive) {
    throw new AppError({
      statusCode: 403,
      code: 'USER_DISABLED',
      message: 'User is disabled.',
    });
  }

  const memberships = asType<
    Array<{ tenantId: string; createdAt: Date; status: string }>
  >(
    await prisma.membership.findMany({
      where: { userId: user.id },
      select: { tenantId: true, createdAt: true, status: true },
    }),
  );
  const tenantId = chooseActiveTenantId(memberships, user.lastTenantId);

  if (tenantId === null) {
    const opened = await createAccountSessionTokens(prisma, user, requestMeta);

    await createActionLog(prisma, {
      actorUserId: user.id,
      action: 'auth.login',
      entityType: 'session',
      entityId: opened.tokens.sessionId,
      requestMeta,
    });

    return attachTokens(
      toAccountContext(user, opened.tokens.sessionId, []),
      opened.tokens,
    );
  }

  const membership = await findActiveMembership(prisma, user.id, tenantId);

  if (!membership || membership.status !== MEMBERSHIP_ACTIVE) {
    throw new AppError({
      statusCode: 403,
      code: 'MEMBERSHIP_NOT_ACTIVE',
      message: 'Membership is not active for this tenant.',
    });
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { lastTenantId: tenantId },
  });
  const tokenSet = await createSessionTokens(prisma, membership, requestMeta);
  const companies = await listActiveCompanies(prisma, membership.userId);

  await createActionLog(prisma, {
    tenantId: membership.tenantId,
    actorUserId: membership.userId,
    action: 'auth.login',
    entityType: 'session',
    entityId: tokenSet.sessionId,
    requestMeta,
  });

  return toAuthResponse(membership, tokenSet, companies);
}

export async function refreshAuthSession(
  refreshToken: string,
  requestMeta: RequestMeta,
): Promise<AuthResponse> {
  const prisma = await getPrisma();
  const refreshTokenHash = await hashOpaqueToken(refreshToken);

  const currentSession = asType<SessionRecord | null>(
    await prisma.session.findUnique({
      where: {
        refreshTokenHash,
      },
    }),
  );

  if (!currentSession || currentSession.revokedAt) {
    throw new AppError({
      statusCode: 401,
      code: 'INVALID_REFRESH_TOKEN',
      message: 'Refresh token is invalid or already revoked.',
    });
  }

  if (currentSession.expiresAt.getTime() <= Date.now()) {
    await prisma.session.update({
      where: {
        id: currentSession.id,
      },
      data: {
        revokedAt: new Date(),
      },
    });

    throw new AppError({
      statusCode: 401,
      code: 'REFRESH_TOKEN_EXPIRED',
      message: 'Refresh token has expired.',
    });
  }

  if (currentSession.tenantId === null) {
    const user = asType<UserRecord | null>(
      await prisma.user.findUnique({
        where: {
          id: currentSession.userId,
        },
      }),
    );

    if (!user || !user.isActive) {
      throw new AppError({
        statusCode: 403,
        code: 'USER_DISABLED',
        message: 'User is disabled.',
      });
    }

    await prisma.session.update({
      where: {
        id: currentSession.id,
      },
      data: {
        revokedAt: new Date(),
      },
    });

    const opened = await createAccountSessionTokens(prisma, user, requestMeta);
    const companies = await listActiveCompanies(prisma, user.id);

    return attachTokens(
      toAccountContext(user, opened.tokens.sessionId, companies),
      opened.tokens,
    );
  }

  const membership = await findActiveMembership(
    prisma,
    currentSession.userId,
    currentSession.tenantId,
  );

  if (!membership || membership.status !== MEMBERSHIP_ACTIVE) {
    throw new AppError({
      statusCode: 401,
      code: 'MEMBERSHIP_NOT_ACTIVE',
      message: 'Membership is no longer active.',
    });
  }

  await prisma.session.update({
    where: {
      id: currentSession.id,
    },
    data: {
      revokedAt: new Date(),
    },
  });

  const tokenSet = await createSessionTokens(prisma, membership, requestMeta);
  const companies = await listActiveCompanies(prisma, membership.userId);

  await createActionLog(prisma, {
    tenantId: membership.tenantId,
    actorUserId: membership.userId,
    action: 'auth.refresh',
    entityType: 'session',
    entityId: tokenSet.sessionId,
    requestMeta,
  });

  return toAuthResponse(membership, tokenSet, companies);
}

export async function logoutByRefreshToken(
  refreshToken: string,
  requestMeta: RequestMeta,
): Promise<boolean> {
  const prisma = await getPrisma();
  const refreshTokenHash = await hashOpaqueToken(refreshToken);

  const session = asType<SessionRecord | null>(
    await prisma.session.findUnique({
      where: {
        refreshTokenHash,
      },
    }),
  );

  if (!session) {
    return false;
  }

  if (!session.revokedAt) {
    await prisma.session.update({
      where: {
        id: session.id,
      },
      data: {
        revokedAt: new Date(),
      },
    });

    await createActionLog(prisma, {
      tenantId: session.tenantId ?? undefined,
      actorUserId: session.userId,
      action: 'auth.logout',
      entityType: 'session',
      entityId: session.id,
      requestMeta,
    });
  }

  return true;
}

export async function resolveAuthContextFromRequest(
  request: Request,
): Promise<AuthContext | null> {
  const prisma = await getPrisma();
  const token = parseBearerToken(request.headers.get('authorization'));

  if (!token) {
    return null;
  }

  const payload = await verifyAccessToken(token);

  if (!payload) {
    return null;
  }

  const session = asType<SessionRecord | null>(
    await prisma.session.findUnique({
      where: {
        id: payload.sid,
      },
    }),
  );

  if (
    !session ||
    session.revokedAt ||
    session.expiresAt.getTime() <= Date.now()
  ) {
    return null;
  }

  if (session.userId !== payload.sub || session.tenantId !== payload.tenantId) {
    return null;
  }

  if (payload.tenantId === null) {
    const user = asType<UserRecord | null>(
      await prisma.user.findUnique({
        where: {
          id: payload.sub,
        },
      }),
    );

    if (!user || !user.isActive) {
      return null;
    }

    const companies = await listActiveCompanies(prisma, user.id);
    return toAccountContext(user, session.id, companies);
  }

  const membership = await findActiveMembership(
    prisma,
    payload.sub,
    payload.tenantId,
  );

  if (!membership || membership.status !== MEMBERSHIP_ACTIVE) {
    return null;
  }

  if (!membership.user.isActive) {
    return null;
  }

  const companies = await listActiveCompanies(prisma, membership.userId);
  return toAuthContext(membership, session.id, companies);
}

export async function requireAuthContext(
  request: Request,
): Promise<AuthContext> {
  const authContext = await resolveAuthContextFromRequest(request);

  if (!authContext) {
    throw new AppError({
      statusCode: 401,
      code: 'UNAUTHORIZED',
      message: 'Authentication is required.',
    });
  }

  return authContext;
}

export function ensurePermission(
  authContext: AuthContext,
  permissionKey: string,
): void {
  if (!authContext.permissions.includes(permissionKey)) {
    throw new AppError({
      statusCode: 403,
      code: 'FORBIDDEN',
      message: `Permission '${permissionKey}' is required.`,
    });
  }
}

export async function createTenantTeam(
  input: {
    tenantId: string;
    actorUserId: string;
    name: string;
    slug?: string;
    description?: string;
    permissionKeys?: TeamPermissionKey[];
    leaderUserIds?: string[];
  },
  requestMeta: RequestMeta,
): Promise<{
  id: string;
  slug: string;
  name: string;
  description: string | null;
  permissionKeys: string[];
}> {
  const prisma = await getPrisma();
  const slug = normalizeTeamSlug(input.slug ?? input.name);

  const result = await prisma.$transaction(async (transaction) => {
    const existing = asType<{ id: string } | null>(
      await transaction.team.findUnique({
        where: {
          tenantId_slug: {
            tenantId: input.tenantId,
            slug,
          },
        },
        select: {
          id: true,
        },
      }),
    );

    if (existing) {
      throw new AppError({
        statusCode: 409,
        code: 'TEAM_SLUG_IN_USE',
        message: 'Team slug is already in use for this tenant.',
      });
    }

    const team = asType<{
      id: string;
      slug: string;
      name: string;
      description: string | null;
    }>(
      await transaction.team.create({
        data: {
          tenantId: input.tenantId,
          slug,
          name: input.name.trim(),
          description: input.description?.trim(),
          isActive: true,
        },
        select: {
          id: true,
          slug: true,
          name: true,
          description: true,
        },
      }),
    );

    const permissionIds = await resolveTeamPermissionIds(
      transaction,
      input.permissionKeys,
    );
    await assignTeamPermissions(transaction, team.id, permissionIds);

    const leaderUserIds = input.leaderUserIds?.length
      ? [...new Set(input.leaderUserIds)]
      : [input.actorUserId];

    const leaderMemberships = asType<Array<{ id: string }>>(
      await transaction.membership.findMany({
        where: {
          tenantId: input.tenantId,
          status: MEMBERSHIP_ACTIVE,
          userId: {
            in: leaderUserIds,
          },
        },
        select: {
          id: true,
        },
      }),
    );

    if (leaderMemberships.length === 0) {
      throw new AppError({
        statusCode: 400,
        code: 'LEADERS_REQUIRED',
        message: 'At least one active tenant user must be assigned as leader.',
      });
    }

    await transaction.teamMembership.createMany({
      data: leaderMemberships.map((membership) => ({
        teamId: team.id,
        membershipId: membership.id,
        role: 'LEADER',
      })),
      skipDuplicates: true,
    });

    await createActionLog(transaction, {
      tenantId: input.tenantId,
      teamId: team.id,
      actorUserId: input.actorUserId,
      action: 'teams.create',
      entityType: 'team',
      entityId: team.id,
      metadata: {
        permissionKeys: input.permissionKeys ?? [],
      },
      requestMeta,
    });

    return team;
  });

  const hydrated = asType<TeamWithPermissions | null>(
    await prisma.team.findUnique({
      where: {
        id: result.id,
      },
      include: {
        permissions: {
          include: {
            permission: true,
          },
        },
      },
    }),
  );

  if (!hydrated) {
    throw new AppError({
      statusCode: 500,
      code: 'TEAM_NOT_FOUND',
      message: 'Could not load team after creation.',
    });
  }

  return {
    id: hydrated.id,
    slug: hydrated.slug,
    name: hydrated.name,
    description: hydrated.description,
    permissionKeys: [
      ...new Set(hydrated.permissions.map((item) => item.permission.key)),
    ].sort((a, b) => a.localeCompare(b)),
  };
}

export async function updateTeamPermissions(
  input: {
    tenantId: string;
    actorUserId: string;
    teamId: string;
    permissionKeys: TeamPermissionKey[];
  },
  requestMeta: RequestMeta,
): Promise<{ teamId: string; permissionKeys: string[] }> {
  const prisma = await getPrisma();

  const team = asType<{ id: string } | null>(
    await prisma.team.findFirst({
      where: {
        id: input.teamId,
        tenantId: input.tenantId,
        isActive: true,
      },
      select: {
        id: true,
      },
    }),
  );

  if (!team) {
    throw new AppError({
      statusCode: 404,
      code: 'TEAM_NOT_FOUND',
      message: 'Team not found for this tenant.',
    });
  }

  const permissionIds = await resolveTeamPermissionIds(
    prisma,
    input.permissionKeys,
  );
  await assignTeamPermissions(prisma, team.id, permissionIds);

  await createActionLog(prisma, {
    tenantId: input.tenantId,
    teamId: team.id,
    actorUserId: input.actorUserId,
    action: 'teams.update_permissions',
    entityType: 'team',
    entityId: team.id,
    metadata: {
      permissionKeys: input.permissionKeys,
    },
    requestMeta,
  });

  return {
    teamId: team.id,
    permissionKeys: [...new Set(input.permissionKeys)].sort((a, b) =>
      a.localeCompare(b),
    ),
  };
}

export async function addTeamMember(
  input: {
    authContext: AuthContext;
    teamId: string;
    targetUserId: string;
    membershipRole?: TeamMembershipRoleValue;
  },
  requestMeta: RequestMeta,
): Promise<{ userId: string; teamId: string; role: TeamMembershipRoleValue }> {
  ensureCanManageTeamMembers(input.authContext, input.teamId);

  const prisma = await getPrisma();

  const team = asType<{ id: string } | null>(
    await prisma.team.findFirst({
      where: {
        id: input.teamId,
        tenantId: input.authContext.tenant.id,
        isActive: true,
      },
      select: {
        id: true,
      },
    }),
  );

  if (!team) {
    throw new AppError({
      statusCode: 404,
      code: 'TEAM_NOT_FOUND',
      message: 'Team not found for this tenant.',
    });
  }

  const membership = await findActiveMembership(
    prisma,
    input.targetUserId,
    input.authContext.tenant.id,
  );

  if (!membership || membership.status !== MEMBERSHIP_ACTIVE) {
    throw new AppError({
      statusCode: 404,
      code: 'MEMBERSHIP_NOT_FOUND',
      message: 'Target user has no active membership on this tenant.',
    });
  }

  const role = input.membershipRole ?? 'MEMBER';

  await prisma.teamMembership.upsert({
    where: {
      teamId_membershipId: {
        teamId: input.teamId,
        membershipId: membership.id,
      },
    },
    update: {
      role,
    },
    create: {
      teamId: input.teamId,
      membershipId: membership.id,
      role,
    },
  });

  await createActionLog(prisma, {
    tenantId: input.authContext.tenant.id,
    teamId: input.teamId,
    actorUserId: input.authContext.user.id,
    action: 'teams.add_member',
    entityType: 'team_membership',
    entityId: membership.id,
    metadata: {
      targetUserId: input.targetUserId,
      role,
    },
    requestMeta,
  });

  return {
    userId: input.targetUserId,
    teamId: input.teamId,
    role,
  };
}

export async function removeTeamMember(
  input: {
    authContext: AuthContext;
    teamId: string;
    targetUserId: string;
  },
  requestMeta: RequestMeta,
): Promise<{ removed: boolean }> {
  ensureCanManageTeamMembers(input.authContext, input.teamId);

  const prisma = await getPrisma();

  const membership = await findActiveMembership(
    prisma,
    input.targetUserId,
    input.authContext.tenant.id,
  );

  if (!membership) {
    return { removed: false };
  }

  const teamMembership = asType<{ role: TeamMembershipRoleValue } | null>(
    await prisma.teamMembership.findUnique({
      where: {
        teamId_membershipId: {
          teamId: input.teamId,
          membershipId: membership.id,
        },
      },
    }),
  );

  if (!teamMembership) {
    return { removed: false };
  }

  if (teamMembership.role === 'LEADER') {
    const leaderCount = asType<number>(
      await prisma.teamMembership.count({
        where: {
          teamId: input.teamId,
          role: 'LEADER',
        },
      }),
    );

    if (leaderCount <= 1) {
      throw new AppError({
        statusCode: 400,
        code: 'LAST_TEAM_LEADER',
        message: 'A team must have at least one leader.',
      });
    }
  }

  await prisma.teamMembership.delete({
    where: {
      teamId_membershipId: {
        teamId: input.teamId,
        membershipId: membership.id,
      },
    },
  });

  await createActionLog(prisma, {
    tenantId: input.authContext.tenant.id,
    teamId: input.teamId,
    actorUserId: input.authContext.user.id,
    action: 'teams.remove_member',
    entityType: 'team_membership',
    entityId: membership.id,
    metadata: {
      targetUserId: input.targetUserId,
    },
    requestMeta,
  });

  return { removed: true };
}

export async function listTenantTeams(tenantId: string): Promise<
  {
    id: string;
    slug: string;
    name: string;
    description: string | null;
    isActive: boolean;
    memberCount: number;
    leaderCount: number;
    permissionKeys: string[];
  }[]
> {
  const prisma = await getPrisma();

  const teams = asType<TeamWithCountsAndPermissions[]>(
    await prisma.team.findMany({
      where: {
        tenantId,
      },
      include: {
        _count: {
          select: {
            members: true,
          },
        },
        members: {
          where: {
            role: 'LEADER',
          },
          select: {
            id: true,
          },
        },
        permissions: {
          include: {
            permission: true,
          },
        },
      },
      orderBy: {
        name: 'asc',
      },
    }),
  );

  return teams.map((team) => ({
    id: team.id,
    slug: team.slug,
    name: team.name,
    description: team.description,
    isActive: team.isActive,
    memberCount: team._count.members,
    leaderCount: team.members.length,
    permissionKeys: [
      ...new Set(team.permissions.map((item) => item.permission.key)),
    ].sort((a, b) => a.localeCompare(b)),
  }));
}

export async function createTenantUser(
  input: {
    tenantId: string;
    actorUserId: string;
    roleName?: AppRoleName;
    email: string;
    name: string;
    password: string;
    teamIds?: string[];
    teamMembershipRole?: TeamMembershipRoleValue;
  },
  requestMeta: RequestMeta,
): Promise<{
  id: string;
  email: string;
  name: string | null;
  role: string;
  teams: TeamContextItem[];
  createdAt: string;
}> {
  if (input.password.length < 8) {
    throw new AppError({
      statusCode: 400,
      code: 'INVALID_PASSWORD',
      message: 'Password must have at least 8 characters.',
    });
  }

  const prisma = await getPrisma();
  const normalizedEmail = normalizeEmail(input.email);
  const roleName = input.roleName ?? defaultRoleName;

  const result = await prisma.$transaction(async (transaction) => {
    const existingUser = asType<{ id: string } | null>(
      await transaction.user.findUnique({
        where: {
          email: normalizedEmail,
        },
        select: {
          id: true,
        },
      }),
    );

    if (existingUser) {
      throw new AppError({
        statusCode: 409,
        code: 'EMAIL_IN_USE',
        message: 'Email is already in use.',
      });
    }

    const roleId = await resolveTenantRoleId(
      transaction,
      input.tenantId,
      roleName,
    );

    const user = asType<UserRecord>(
      await transaction.user.create({
        data: {
          email: normalizedEmail,
          name: input.name.trim(),
          passwordHash: await hashPassword(input.password),
        },
      }),
    );

    const membership = asType<{ id: string }>(
      await transaction.membership.create({
        data: {
          tenantId: input.tenantId,
          userId: user.id,
          roleId,
          status: MEMBERSHIP_ACTIVE,
        },
        select: {
          id: true,
        },
      }),
    );

    const teamIds = await resolveTeamIdsForMembership(
      transaction,
      input.tenantId,
      input.teamIds,
    );

    await assignMembershipTeams(
      transaction,
      membership.id,
      teamIds,
      input.teamMembershipRole ?? 'MEMBER',
    );

    await createActionLog(transaction, {
      tenantId: input.tenantId,
      actorUserId: input.actorUserId,
      action: 'users.create',
      entityType: 'user',
      entityId: user.id,
      metadata: {
        roleName,
        teamIds,
      },
      requestMeta,
    });

    const hydratedMembership = await findActiveMembership(
      transaction,
      user.id,
      input.tenantId,
    );

    if (!hydratedMembership) {
      throw new AppError({
        statusCode: 500,
        code: 'MEMBERSHIP_NOT_FOUND',
        message: 'Could not initialize user membership.',
      });
    }

    return hydratedMembership;
  });

  return {
    id: result.user.id,
    email: result.user.email,
    name: result.user.name,
    role: result.role.name,
    teams: toUniqueSortedTeams(result),
    createdAt: result.createdAt.toISOString(),
  };
}

export async function listTenantUsers(tenantId: string): Promise<
  {
    id: string;
    email: string;
    name: string | null;
    role: string;
    status: string;
    teams: TeamContextItem[];
    createdAt: string;
  }[]
> {
  const prisma = await getPrisma();

  const memberships = asType<MembershipWithRelations[]>(
    await prisma.membership.findMany({
      where: {
        tenantId,
      },
      include: {
        user: true,
        role: true,
        teams: {
          include: {
            team: {
              include: {
                permissions: {
                  include: {
                    permission: true,
                  },
                },
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    }),
  );

  return memberships.map((membership) => ({
    id: membership.user.id,
    email: membership.user.email,
    name: membership.user.name,
    role: membership.role.name,
    status: membership.status,
    teams: toUniqueSortedTeams(membership),
    createdAt: membership.createdAt.toISOString(),
  }));
}

export async function listTenantActionLogs(
  tenantId: string,
  limit = 100,
): Promise<
  {
    id: string;
    action: string;
    entityType: string;
    entityId: string | null;
    actorUserId: string | null;
    teamId: string | null;
    metadata: unknown;
    createdAt: string;
  }[]
> {
  const prisma = await getPrisma();
  const clampedLimit = Math.min(Math.max(limit, 1), 200);

  const logs = asType<ActionLogRecord[]>(
    await prisma.actionLog.findMany({
      where: {
        tenantId,
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: clampedLimit,
    }),
  );

  return logs.map((log) => ({
    id: log.id,
    action: log.action,
    entityType: log.entityType,
    entityId: log.entityId,
    actorUserId: log.actorUserId,
    teamId: log.teamId,
    metadata: log.metadata,
    createdAt: log.createdAt.toISOString(),
  }));
}
