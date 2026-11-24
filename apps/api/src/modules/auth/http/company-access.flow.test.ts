import { defaultDepartmentIconKey } from '@myrophone/shared';
import { afterAll, describe, expect, it } from 'vitest';
import { getPrisma } from '../../../core/db/prisma';
import { asType } from '../db-types';
import { ensureTenantRbac } from '../tenant-bootstrap';
import {
  cleanupAuthTests,
  deleteAuth,
  getAuth,
  patchAuth,
  postAuth,
  putAuth,
} from './auth-flow-client';

const password = 'senha-forte';

afterAll(async () => {
  await cleanupAuthTests();
});

async function registerOwner(label: string): Promise<{
  email: string;
  accessToken: string;
  userId: string;
  tenantId: string;
  teamId: string;
}> {
  const email = `${label}-${crypto.randomUUID()}@auth-test.local`;
  const registered = await postAuth('/auth/register', {
    name: 'Dona Teste',
    phone: '11987654321',
    email,
    password,
  });
  expect(registered.status).toBe(201);
  const registeredTokens = registered.body.tokens as {
    accessToken: string;
    refreshToken: string;
  };
  const created = await postAuth(
    '/auth/companies',
    {
      name: `Auth Test ${label}`,
      description: 'Empresa de teste',
      refreshToken: registeredTokens.refreshToken,
    },
    registeredTokens.accessToken,
  );
  expect(created.status).toBe(200);
  const accessToken = (created.body.tokens as { accessToken: string })
    .accessToken;
  const tenantId = (created.body.tenant as { id: string }).id;
  const userId = (created.body.user as { id: string }).id;
  const teams = await getAuth('/teams', accessToken);
  expect(teams.status).toBe(200);
  const items = teams.body.items as Array<{ id: string; slug: string }>;
  const teamId = (items.find((team) => team.slug === 'geral') ?? items[0]).id;
  return { email, accessToken, userId, tenantId, teamId };
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

async function addOwnedCompany(
  userId: string,
  name: string,
  teamName: string,
): Promise<{ tenantId: string; teamId: string }> {
  const prisma = await getPrisma();
  const tenant = asType<{ id: string }>(
    await prisma.tenant.create({
      data: { name, slug: `auth-test-${crypto.randomUUID()}` },
    }),
  );
  const roleIds = await ensureTenantRbac(prisma, tenant.id);
  const membership = asType<{ id: string }>(
    await prisma.membership.create({
      data: {
        tenantId: tenant.id,
        userId,
        roleId: roleIds.OWNER,
        status: 'ACTIVE',
      },
      select: { id: true },
    }),
  );
  const team = asType<{ id: string }>(
    await prisma.team.create({
      data: {
        tenantId: tenant.id,
        slug: 'filial',
        name: teamName,
        isActive: true,
      },
      select: { id: true },
    }),
  );
  await prisma.teamMembership.create({
    data: { teamId: team.id, membershipId: membership.id, role: 'LEADER' },
  });
  return { tenantId: tenant.id, teamId: team.id };
}

describe('POST /companies/members/invite', () => {
  it('adds an existing account as USER without a department', async () => {
    const owner = await registerOwner('invite-owner');
    const guestEmail = `guest-${crypto.randomUUID()}@auth-test.local`;
    const guest = await postAuth('/auth/register', {
      name: 'Convidada',
      phone: '11911112222',
      email: guestEmail,
      password,
    });
    expect(guest.status).toBe(201);

    const response = await postAuth(
      '/companies/members/invite',
      { email: guestEmail.toUpperCase() },
      owner.accessToken,
    );
    const prisma = await getPrisma();
    const membership = asType<{
      id: string;
      status: string;
      role: { name: string };
      teams: unknown[];
    } | null>(
      await prisma.membership.findFirst({
        where: { tenantId: owner.tenantId, user: { email: guestEmail } },
        include: { role: true, teams: true },
      }),
    );
    const logs = asType<Array<{ action: string }>>(
      await prisma.actionLog.findMany({
        where: { action: 'members.invite', tenantId: owner.tenantId },
      }),
    );
    const guestLogin = await postAuth('/auth/login', {
      email: guestEmail,
      password,
    });

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      email: guestEmail,
      name: 'Convidada',
      role: 'USER',
    });
    expect(membership?.status).toBe('ACTIVE');
    expect(membership?.role.name).toBe('USER');
    expect(membership?.teams).toEqual([]);
    expect(logs).toHaveLength(1);
    expect(guestLogin.status).toBe(200);
    expect(guestLogin.body.companies).toEqual([
      expect.objectContaining({ id: owner.tenantId }),
    ]);
  });

  it('rejects an unknown email, a duplicate, a disabled account, and a non-owner', async () => {
    const owner = await registerOwner('invite-errors');
    const unknown = await postAuth(
      '/companies/members/invite',
      { email: `missing-${crypto.randomUUID()}@auth-test.local` },
      owner.accessToken,
    );
    const admin = await memberToken(owner.accessToken, 'ADMIN', 'invite-admin');
    const user = await memberToken(owner.accessToken, 'USER', 'invite-user');
    const duplicate = await postAuth(
      '/companies/members/invite',
      { email: admin.email },
      owner.accessToken,
    );
    const asAdmin = await postAuth(
      '/companies/members/invite',
      { email: owner.email },
      admin.accessToken,
    );
    const asUser = await postAuth(
      '/companies/members/invite',
      { email: owner.email },
      user.accessToken,
    );
    const badRole = await postAuth(
      '/companies/members/invite',
      { email: owner.email, role: 'OWNER' },
      owner.accessToken,
    );
    const anonymous = await postAuth('/companies/members/invite', {
      email: owner.email,
    });
    const registered = await postAuth('/auth/register', {
      name: 'Sem Empresa',
      phone: '11900001111',
      email: `bare-${crypto.randomUUID()}@auth-test.local`,
      password,
    });
    const noCompany = await postAuth(
      '/companies/members/invite',
      { email: owner.email },
      (registered.body.tokens as { accessToken: string }).accessToken,
    );
    const prisma = await getPrisma();
    const disabledEmail = `disabled-${crypto.randomUUID()}@auth-test.local`;
    await postAuth('/auth/register', {
      name: 'Inativa',
      phone: '11900002222',
      email: disabledEmail,
      password,
    });
    await prisma.user.update({
      where: { email: disabledEmail },
      data: { isActive: false },
    });
    const disabled = await postAuth(
      '/companies/members/invite',
      { email: disabledEmail },
      owner.accessToken,
    );

    expect(unknown.status).toBe(404);
    expect(unknown.body.error).toBe('USER_NOT_REGISTERED');
    expect(duplicate.status).toBe(409);
    expect(duplicate.body.error).toBe('ALREADY_IN_COMPANY');
    expect(asAdmin.status).toBe(403);
    expect(asAdmin.body.error).toBe('NOT_COMPANY_OWNER');
    expect(asUser.body.error).toBe('NOT_COMPANY_OWNER');
    expect(badRole.status).toBe(422);
    expect(badRole.body.error).toBe('VALIDATION_ERROR');
    expect(anonymous.status).toBe(401);
    expect(anonymous.body.error).toBe('UNAUTHORIZED');
    expect(noCompany.status).toBe(403);
    expect(noCompany.body.error).toBe('NO_ACTIVE_TENANT');
    expect(disabled.status).toBe(403);
    expect(disabled.body.error).toBe('USER_DISABLED');
  });
});

describe('POST /companies/members', () => {
  it('creates one account in every company the actor owns', async () => {
    const owner = await registerOwner('create-owner');
    const second = await addOwnedCompany(
      owner.userId,
      'Auth Test z filial',
      'Filial',
    );
    const email = `created-${crypto.randomUUID()}@auth-test.local`;
    const response = await postAuth(
      '/companies/members',
      {
        name: ' Nova Pessoa ',
        phone: ' (11) 98888-7777 ',
        email: email.toUpperCase(),
        password,
        companies: [
          { tenantId: owner.tenantId, teamId: owner.teamId },
          { tenantId: second.tenantId, teamId: second.teamId },
        ],
      },
      owner.accessToken,
    );
    const login = await postAuth('/auth/login', { email, password });
    const prisma = await getPrisma();
    const logs = asType<Array<{ tenantId: string; action: string }>>(
      await prisma.actionLog.findMany({
        where: {
          action: 'members.create',
          metadata: { path: ['email'], equals: email },
        },
      }),
    );

    expect(response.status).toBe(201);
    expect(response.body.user).toMatchObject({
      name: 'Nova Pessoa',
      email,
      phone: '(11) 98888-7777',
    });
    expect(response.body).not.toHaveProperty('password');
    expect(JSON.stringify(response.body)).not.toContain('passwordHash');
    const memberships = response.body.memberships as Array<{
      tenantId: string;
      role: string;
      team: { id: string };
    }>;
    expect(memberships.map((item) => item.tenantId)).toEqual([
      owner.tenantId,
      second.tenantId,
    ]);
    expect(memberships.every((item) => item.role === 'USER')).toBe(true);
    expect(memberships.map((item) => item.team.id)).toEqual([
      owner.teamId,
      second.teamId,
    ]);
    expect(login.status).toBe(200);
    expect(login.body.companies).toEqual([
      expect.objectContaining({ id: owner.tenantId }),
      expect.objectContaining({ id: second.tenantId }),
    ]);
    expect(logs).toHaveLength(2);
  });

  it('rejects email in use, a company the actor does not own, a foreign department, and duplicates', async () => {
    const owner = await registerOwner('create-errors');
    const other = await registerOwner('create-other');
    const second = await addOwnedCompany(
      owner.userId,
      'Auth Test Outra Filial',
      'Filial',
    );
    const email = `blocked-${crypto.randomUUID()}@auth-test.local`;
    const foreignTeam = await postAuth(
      '/companies/members',
      {
        name: 'Bloqueada',
        phone: '11987654321',
        email,
        password,
        companies: [{ tenantId: owner.tenantId, teamId: second.teamId }],
      },
      owner.accessToken,
    );
    const notOwned = await postAuth(
      '/companies/members',
      {
        name: 'Bloqueada',
        phone: '11987654321',
        email,
        password,
        companies: [{ tenantId: other.tenantId, teamId: other.teamId }],
      },
      owner.accessToken,
    );
    const duplicateCompany = await postAuth(
      '/companies/members',
      {
        name: 'Bloqueada',
        phone: '11987654321',
        email,
        password,
        companies: [
          { tenantId: owner.tenantId, teamId: owner.teamId },
          { tenantId: owner.tenantId, teamId: owner.teamId },
        ],
      },
      owner.accessToken,
    );
    const emptyList = await postAuth(
      '/companies/members',
      {
        name: 'Bloqueada',
        phone: '11987654321',
        email,
        password,
        companies: [],
      },
      owner.accessToken,
    );
    const taken = await postAuth(
      '/companies/members',
      {
        name: 'Bloqueada',
        phone: '11987654321',
        email: owner.email,
        password,
        companies: [{ tenantId: owner.tenantId, teamId: owner.teamId }],
      },
      owner.accessToken,
    );
    const admin = await memberToken(owner.accessToken, 'ADMIN', 'create-admin');
    const adminCompany = await addOwnedCompany(
      admin.userId,
      'Auth Test Do Admin',
      'Filial',
    );
    const asAdmin = await postAuth(
      '/companies/members',
      {
        name: 'Bloqueada',
        phone: '11987654321',
        email: `admin-try-${crypto.randomUUID()}@auth-test.local`,
        password,
        companies: [
          { tenantId: adminCompany.tenantId, teamId: adminCompany.teamId },
        ],
      },
      admin.accessToken,
    );
    const prisma = await getPrisma();
    const createdUser = await prisma.user.findUnique({ where: { email } });

    expect(foreignTeam.status).toBe(400);
    expect(foreignTeam.body.error).toBe('TEAM_NOT_IN_COMPANY');
    expect(notOwned.status).toBe(403);
    expect(notOwned.body.error).toBe('COMPANY_NOT_OWNED');
    expect(duplicateCompany.status).toBe(400);
    expect(duplicateCompany.body.error).toBe('DUPLICATE_COMPANY');
    expect(emptyList.status).toBe(422);
    expect(emptyList.body.error).toBe('VALIDATION_ERROR');
    expect(taken.status).toBe(409);
    expect(taken.body.error).toBe('EMAIL_IN_USE');
    expect(asAdmin.status).toBe(403);
    expect(asAdmin.body.error).toBe('NOT_COMPANY_OWNER');
    expect(createdUser).toBeNull();
  });
});

describe('company member list and removal', () => {
  it('lists the active company and removes one membership', async () => {
    const owner = await registerOwner('list-owner');
    const second = await addOwnedCompany(
      owner.userId,
      'Auth Test Permanece',
      'Filial',
    );
    const email = `listed-${crypto.randomUUID()}@auth-test.local`;
    const created = await postAuth(
      '/companies/members',
      {
        name: 'Listada',
        phone: '11987654321',
        email,
        password,
        companies: [
          { tenantId: owner.tenantId, teamId: owner.teamId },
          { tenantId: second.tenantId, teamId: second.teamId },
        ],
      },
      owner.accessToken,
    );
    expect(created.status).toBe(201);
    const createdUserId = (created.body.user as { id: string }).id;
    const listed = await getAuth('/companies/members', owner.accessToken);
    const items = listed.body.members as Array<{
      userId: string;
      email: string;
      role: string;
      team: { id: string } | null;
    }>;
    const sessionBefore = await postAuth('/auth/login', { email, password });
    expect(sessionBefore.status).toBe(200);
    const tokenBefore = (sessionBefore.body.tokens as { accessToken: string })
      .accessToken;
    const removed = await deleteAuth(
      `/companies/members/${createdUserId}`,
      owner.accessToken,
    );
    const after = await getAuth('/companies/members', owner.accessToken);
    const denied = await getAuth('/auth/me', tokenBefore);
    const login = await postAuth('/auth/login', { email, password });
    const prisma = await getPrisma();
    const user = await prisma.user.findUnique({ where: { email } });
    const logs = asType<Array<{ action: string }>>(
      await prisma.actionLog.findMany({
        where: { action: 'members.remove', tenantId: owner.tenantId },
      }),
    );

    expect(listed.status).toBe(200);
    expect(items.map((item) => item.email).sort()).toEqual(
      [owner.email, email].sort(),
    );
    expect(items.find((item) => item.email === email)?.role).toBe('USER');
    expect(items.find((item) => item.email === email)?.team?.id).toBe(
      owner.teamId,
    );
    expect(removed).toMatchObject({ status: 200, body: { removed: true } });
    expect(
      (after.body.members as Array<{ email: string }>).some(
        (item) => item.email === email,
      ),
    ).toBe(false);
    expect(user).not.toBeNull();
    expect(login.status).toBe(200);
    expect(login.body.companies).toEqual([
      expect.objectContaining({ id: second.tenantId }),
    ]);
    expect(logs).toHaveLength(1);
    expect(denied.status).toBe(401);
    expect(denied.body.error).toBe('UNAUTHORIZED');
  });

  it('keeps the last owner and rejects a missing member', async () => {
    const owner = await registerOwner('last-owner');
    const self = await deleteAuth(
      `/companies/members/${owner.userId}`,
      owner.accessToken,
    );
    const missing = await deleteAuth(
      `/companies/members/${crypto.randomUUID()}`,
      owner.accessToken,
    );
    const secondOwner = await postAuth(
      '/users',
      {
        name: 'Outro Dono',
        email: `co-owner-${crypto.randomUUID()}@auth-test.local`,
        password,
        roleName: 'OWNER',
      },
      owner.accessToken,
    );
    expect(secondOwner.status).toBe(201);
    const removedOwner = await deleteAuth(
      `/companies/members/${(secondOwner.body as { id: string }).id}`,
      owner.accessToken,
    );
    const prisma = await getPrisma();
    const ownerMembership = await prisma.membership.findUnique({
      where: {
        tenantId_userId: { tenantId: owner.tenantId, userId: owner.userId },
      },
    });

    expect(self.status).toBe(409);
    expect(self.body.error).toBe('LAST_OWNER');
    expect(ownerMembership).not.toBeNull();
    expect(missing.status).toBe(404);
    expect(missing.body.error).toBe('MEMBERSHIP_NOT_FOUND');
    expect(removedOwner.status).toBe(200);
  });
});

describe('GET /companies/members pagination', () => {
  it('returns one page, filters name or email, and rejects a non-owner', async () => {
    const owner = await registerOwner('sheet-owner');
    const prisma = await getPrisma();
    const role = asType<{ id: string } | null>(
      await prisma.role.findFirst({
        where: { tenantId: owner.tenantId, name: 'USER' },
        select: { id: true },
      }),
    );
    const stamp = crypto.randomUUID();
    expect(role).not.toBeNull();

    for (let index = 1; index <= 22; index += 1) {
      const label = String(index).padStart(2, '0');
      const user = asType<{ id: string }>(
        await prisma.user.create({
          data: {
            name: `Page ${label}`,
            email: `m${label}-${stamp}@auth-test.local`,
            phone: '11987654321',
            passwordHash: 'test-hash',
            avatarUrl:
              index === 1 ? 'https://cdn.example/page-01.png' : null,
          },
          select: { id: true },
        }),
      );
      await prisma.membership.create({
        data: {
          tenantId: owner.tenantId,
          userId: user.id,
          roleId: role?.id,
          status: 'ACTIVE',
        },
      });
    }

    const zebraEmail = `inbox-${stamp}@auth-test.local`;
    const zebra = asType<{ id: string }>(
      await prisma.user.create({
        data: {
          name: 'Zebra Unica',
          email: zebraEmail,
          phone: '11987654321',
          passwordHash: 'test-hash',
        },
        select: { id: true },
      }),
    );
    await prisma.membership.create({
      data: {
        tenantId: owner.tenantId,
        userId: zebra.id,
        roleId: role?.id,
        status: 'ACTIVE',
      },
    });

    const first = await getAuth(
      '/companies/members?page=1&pageSize=10',
      owner.accessToken,
    );
    const second = await getAuth(
      '/companies/members?page=2&pageSize=10',
      owner.accessToken,
    );
    const defaults = await getAuth('/companies/members', owner.accessToken);
    const byName = await getAuth(
      `/companies/members?q=${encodeURIComponent('PAGE 22')}`,
      owner.accessToken,
    );
    const byEmail = await getAuth(
      `/companies/members?q=${encodeURIComponent(zebraEmail)}`,
      owner.accessToken,
    );
    const byPage = await getAuth(
      '/companies/members?q=page&pageSize=20',
      owner.accessToken,
    );
    const admin = await memberToken(
      owner.accessToken,
      'ADMIN',
      'sheet-admin',
    );
    const denied = await getAuth(
      '/companies/members?page=1&q=page',
      admin.accessToken,
    );
    const firstMembers = first.body.members as Array<{
      userId: string;
      name: string;
      avatarUrl: string | null;
    }>;
    const secondMembers = second.body.members as Array<{ userId: string }>;
    const firstIds = new Set(firstMembers.map((member) => member.userId));

    expect(first.status).toBe(200);
    expect(first.body.page).toBe(1);
    expect(first.body.pageSize).toBe(10);
    expect(firstMembers).toHaveLength(10);
    expect(firstMembers.length).toBeLessThanOrEqual(10);
    expect(second.status).toBe(200);
    expect(secondMembers).toHaveLength(10);
    expect(secondMembers.every((member) => !firstIds.has(member.userId))).toBe(
      true,
    );
    expect(firstMembers.map((member) => member.name)).toEqual([
      'Dona Teste',
      'Page 01',
      'Page 02',
      'Page 03',
      'Page 04',
      'Page 05',
      'Page 06',
      'Page 07',
      'Page 08',
      'Page 09',
    ]);
    expect(firstMembers[1]?.avatarUrl).toBe('https://cdn.example/page-01.png');
    expect(defaults.body.pageSize).toBe(20);
    expect((defaults.body.members as unknown[]).length).toBeLessThanOrEqual(20);
    expect(defaults.body.total).toBe(24);
    expect(byName.body.total).toBe(1);
    expect(byName.body.members).toEqual([
      expect.objectContaining({ name: 'Page 22', email: `m22-${stamp}@auth-test.local` }),
    ]);
    expect(byEmail.body.total).toBe(1);
    expect(byEmail.body.members).toEqual([
      expect.objectContaining({ name: 'Zebra Unica', email: zebraEmail }),
    ]);
    expect(byPage.body.total).toBe(22);
    expect((byPage.body.members as unknown[]).length).toBeLessThanOrEqual(20);
    expect(denied.status).toBe(403);
    expect(denied.body.error).toBe('NOT_COMPANY_OWNER');
  });

  it('pages one department and hides people already in it from candidates', async () => {
    const owner = await registerOwner('dept-page');
    const prisma = await getPrisma();
    const role = asType<{ id: string } | null>(
      await prisma.role.findFirst({
        where: { tenantId: owner.tenantId, name: 'USER' },
        select: { id: true },
      }),
    );
    const stamp = crypto.randomUUID();
    const createdIds: string[] = [];

    for (const name of ['Ana Costa', 'Bruno Lima', 'Caio Nunes']) {
      const user = asType<{ id: string }>(
        await prisma.user.create({
          data: {
            name,
            email: `${name.split(' ')[0]?.toLowerCase()}-${stamp}@auth-test.local`,
            phone: '11987654321',
            passwordHash: 'test-hash',
          },
          select: { id: true },
        }),
      );
      await prisma.membership.create({
        data: {
          tenantId: owner.tenantId,
          userId: user.id,
          roleId: role?.id,
          status: 'ACTIVE',
        },
      });
      const added = await postAuth(
        `/teams/${owner.teamId}/members`,
        { userId: user.id },
        owner.accessToken,
      );
      expect(added.status).toBe(200);
      createdIds.push(user.id);
    }

    const outside = asType<{ id: string }>(
      await prisma.user.create({
        data: {
          name: 'Diana Fora',
          email: `diana-${stamp}@auth-test.local`,
          phone: '11987654321',
          passwordHash: 'test-hash',
        },
        select: { id: true },
      }),
    );
    await prisma.membership.create({
      data: {
        tenantId: owner.tenantId,
        userId: outside.id,
        roleId: role?.id,
        status: 'ACTIVE',
      },
    });

    const pageOne = await getAuth(
      `/teams/${owner.teamId}/members?page=1&pageSize=2`,
      owner.accessToken,
    );
    const pageTwo = await getAuth(
      `/teams/${owner.teamId}/members?page=2&pageSize=2`,
      owner.accessToken,
    );
    const byName = await getAuth(
      `/teams/${owner.teamId}/members?q=${encodeURIComponent('NUNES')}`,
      owner.accessToken,
    );
    const byEmail = await getAuth(
      `/teams/${owner.teamId}/members?q=${encodeURIComponent(`bruno-${stamp}`)}`,
      owner.accessToken,
    );
    const candidates = await getAuth(
      `/teams/${owner.teamId}/candidates?q=diana`,
      owner.accessToken,
    );
    const admin = await memberToken(owner.accessToken, 'USER', 'dept-page-user');
    const denied = await getAuth(
      `/teams/${owner.teamId}/members?page=1`,
      admin.accessToken,
    );
    const firstIds = new Set(
      (pageOne.body.members as Array<{ userId: string }>).map(
        (member) => member.userId,
      ),
    );
    const secondIds = (pageTwo.body.members as Array<{ userId: string }>).map(
      (member) => member.userId,
    );
    const overlap = secondIds.filter((id) => firstIds.has(id));

    expect(pageOne.status).toBe(200);
    expect(pageOne.body.pageSize).toBe(2);
    expect(firstIds.size).toBe(2);
    expect(pageOne.body.total).toBe(4);
    expect(secondIds).toHaveLength(2);
    expect(overlap).toEqual([]);
    expect(pageTwo.body.total).toBe(4);
    expect(byName.body.total).toBe(1);
    expect(byName.body.members).toEqual([
      expect.objectContaining({ name: 'Caio Nunes' }),
    ]);
    expect(byEmail.body.total).toBe(1);
    expect(byEmail.body.members).toEqual([
      expect.objectContaining({ name: 'Bruno Lima' }),
    ]);
    expect(candidates.body.total).toBe(1);
    expect(candidates.body.members).toEqual([
      expect.objectContaining({ userId: outside.id, name: 'Diana Fora' }),
    ]);
    expect(createdIds).toHaveLength(3);
    expect(denied.status).toBe(403);
    expect(denied.body.error).toBe('NOT_COMPANY_OWNER');
  });
});

describe('department assignment and owned companies', () => {
  it('moves a member into one department of the active company', async () => {
    const owner = await registerOwner('team-owner');
    const guestEmail = `team-guest-${crypto.randomUUID()}@auth-test.local`;
    await postAuth('/auth/register', {
      name: 'Sem Time',
      phone: '11987654321',
      email: guestEmail,
      password,
    });
    const invited = await postAuth(
      '/companies/members/invite',
      { email: guestEmail },
      owner.accessToken,
    );
    const guestId = invited.body.userId as string;
    const before = await getAuth('/companies/members', owner.accessToken);
    const assigned = await putAuth(
      `/companies/members/${guestId}/team`,
      { teamId: owner.teamId },
      owner.accessToken,
    );
    const again = await putAuth(
      `/companies/members/${guestId}/team`,
      { teamId: owner.teamId },
      owner.accessToken,
    );
    const after = await getAuth('/companies/members', owner.accessToken);
    const second = await addOwnedCompany(
      owner.userId,
      'Auth Test Time Alheio',
      'Filial',
    );
    const foreign = await putAuth(
      `/companies/members/${guestId}/team`,
      { teamId: second.teamId },
      owner.accessToken,
    );
    const moveOwner = await putAuth(
      `/companies/members/${owner.userId}/team`,
      { teamId: owner.teamId },
      owner.accessToken,
    );
    const prisma = await getPrisma();
    const extraTeam = asType<{ id: string }>(
      await prisma.team.create({
        data: {
          tenantId: owner.tenantId,
          slug: `extra-${crypto.randomUUID()}`,
          name: 'Extra',
          isActive: true,
        },
        select: { id: true },
      }),
    );
    const blocked = await putAuth(
      `/companies/members/${owner.userId}/team`,
      { teamId: extraTeam.id },
      owner.accessToken,
    );
    const logs = asType<unknown[]>(
      await prisma.actionLog.findMany({
        where: { action: 'members.team_assign', tenantId: owner.tenantId },
      }),
    );
    const guestBefore = (
      before.body.members as Array<{ userId: string; team: unknown }>
    ).find((item) => item.userId === guestId);

    expect(guestBefore?.team).toBeNull();
    expect(assigned).toMatchObject({
      status: 200,
      body: { userId: guestId, teamId: owner.teamId, role: 'MEMBER' },
    });
    expect(again.body).toMatchObject({ role: 'MEMBER' });
    expect(
      (
        after.body.members as Array<{
          userId: string;
          team: { id: string } | null;
        }>
      ).find((item) => item.userId === guestId)?.team?.id,
    ).toBe(owner.teamId);
    expect(foreign.status).toBe(400);
    expect(foreign.body.error).toBe('TEAM_NOT_IN_COMPANY');
    expect(moveOwner.body).toMatchObject({ role: 'LEADER' });
    expect(blocked.status).toBe(400);
    expect(blocked.body.error).toBe('LAST_TEAM_LEADER');
    expect(logs).toHaveLength(1);
  });

  it('lists only companies the actor owns, with active teams', async () => {
    const owner = await registerOwner('owned-list');
    const second = await addOwnedCompany(
      owner.userId,
      'Auth Test a filial',
      'Filial',
    );
    const admin = await memberToken(owner.accessToken, 'ADMIN', 'owned-admin');
    const listed = await getAuth('/companies/owned', owner.accessToken);
    const asAdmin = await getAuth('/companies/owned', admin.accessToken);
    const teams = await getAuth('/teams', owner.accessToken);
    const firstTeam = (
      teams.body.items as Array<{
        memberCount: number;
        permissionKeys: string[];
      }>
    )[0];

    expect(listed.status).toBe(200);
    expect(listed.body.items).toEqual([
      expect.objectContaining({
        id: second.tenantId,
        teams: [expect.objectContaining({ id: second.teamId, name: 'Filial' })],
      }),
      expect.objectContaining({
        id: owner.tenantId,
        teams: [expect.objectContaining({ slug: 'geral' })],
      }),
    ]);
    expect(asAdmin.status).toBe(403);
    expect(asAdmin.body.error).toBe('NOT_COMPANY_OWNER');
    expect(firstTeam.memberCount).toBeGreaterThan(0);
    expect(Array.isArray(firstTeam.permissionKeys)).toBe(true);
  });

  it('creates a department and removes a person from that department only', async () => {
    const owner = await registerOwner('dept-actions');
    const guestEmail = `dept-guest-${crypto.randomUUID()}@auth-test.local`;
    await postAuth('/auth/register', {
      name: 'Sem Time',
      phone: '11987654321',
      email: guestEmail,
      password,
    });
    const invited = await postAuth(
      '/companies/members/invite',
      { email: guestEmail },
      owner.accessToken,
    );
    const guestId = invited.body.userId as string;
    const created = await postAuth(
      '/teams',
      { name: 'Fiscal', description: 'Impostos' },
      owner.accessToken,
    );
    const fiscalId = created.body.id as string;
    const inGeral = await postAuth(
      `/teams/${owner.teamId}/members`,
      { userId: guestId },
      owner.accessToken,
    );
    const inFiscal = await postAuth(
      `/teams/${fiscalId}/members`,
      { userId: guestId },
      owner.accessToken,
    );
    const both = await getAuth('/companies/members', owner.accessToken);
    const removed = await deleteAuth(
      `/teams/${fiscalId}/members/${guestId}`,
      owner.accessToken,
    );
    const after = await getAuth('/companies/members', owner.accessToken);
    const blocked = await deleteAuth(
      `/teams/${owner.teamId}/members/${owner.userId}`,
      owner.accessToken,
    );
    const prisma = await getPrisma();
    const logs = asType<Array<{ action: string }>>(
      await prisma.actionLog.findMany({
        where: {
          tenantId: owner.tenantId,
          action: { in: ['teams.create', 'teams.add_member', 'teams.remove_member'] },
        },
      }),
    );
    const guestBoth = (
      both.body.members as Array<{
        userId: string;
        teams: Array<{ id: string }>;
      }>
    ).find((item) => item.userId === guestId);
    const guestAfter = (
      after.body.members as Array<{
        userId: string;
        teams: Array<{ id: string }>;
      }>
    ).find((item) => item.userId === guestId);

    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({
      name: 'Fiscal',
      slug: 'fiscal',
      description: 'Impostos',
    });
    expect(inGeral.status).toBe(200);
    expect(inFiscal.status).toBe(200);
    expect(guestBoth?.teams.map((team) => team.id).sort()).toEqual(
      [owner.teamId, fiscalId].sort(),
    );
    expect(removed).toMatchObject({ status: 200, body: { removed: true } });
    expect(guestAfter?.teams.map((team) => team.id)).toEqual([owner.teamId]);
    expect(blocked.status).toBe(400);
    expect(blocked.body.error).toBe('LAST_TEAM_LEADER');
    expect(logs.map((log) => log.action).sort()).toEqual(
      [
        'teams.add_member',
        'teams.add_member',
        'teams.create',
        'teams.remove_member',
      ].sort(),
    );
  });

  it('lets the owner edit a department name and description without changing the slug', async () => {
    const owner = await registerOwner('dept-settings');
    const admin = await memberToken(
      owner.accessToken,
      'ADMIN',
      'dept-settings-admin',
    );
    const updated = await patchAuth(
      `/teams/${owner.teamId}`,
      { name: 'Contábil', description: 'Notas fiscais' },
      owner.accessToken,
    );
    const cleared = await patchAuth(
      `/teams/${owner.teamId}`,
      { name: 'Contábil', description: null },
      owner.accessToken,
    );
    const forbidden = await patchAuth(
      `/teams/${owner.teamId}`,
      { name: 'Invasão', description: 'Não' },
      admin.accessToken,
    );
    const listed = await getAuth('/teams', owner.accessToken);
    const team = (
      listed.body.items as Array<{
        id: string;
        slug: string;
        name: string;
        description: string | null;
      }>
    ).find((item) => item.id === owner.teamId);
    const prisma = await getPrisma();
    const logs = asType<Array<{ action: string }>>(
      await prisma.actionLog.findMany({
        where: { tenantId: owner.tenantId, action: 'teams.update' },
      }),
    );

    expect(updated.status).toBe(200);
    expect(updated.body).toMatchObject({
      id: owner.teamId,
      slug: 'geral',
      name: 'Contábil',
      description: 'Notas fiscais',
    });
    expect(cleared.status).toBe(200);
    expect(cleared.body).toMatchObject({
      slug: 'geral',
      name: 'Contábil',
      description: null,
    });
    expect(forbidden.status).toBe(403);
    expect(forbidden.body.error).toBe('NOT_COMPANY_OWNER');
    expect(team).toMatchObject({
      slug: 'geral',
      name: 'Contábil',
      description: null,
    });
    expect(logs).toHaveLength(2);
  });

  it('stores a catalog icon and rejects an unknown one', async () => {
    const owner = await registerOwner('dept-icon');
    const admin = await memberToken(owner.accessToken, 'ADMIN', 'dept-icon-admin');
    const created = await postAuth(
      '/teams',
      { name: 'Logística', description: 'Entregas', icon: 'truck' },
      owner.accessToken,
    );
    const fiscalId = created.body.id as string;
    const rejected = await postAuth(
      '/teams',
      { name: 'Inventado', icon: 'not-a-real-icon' },
      owner.accessToken,
    );
    const updated = await patchAuth(
      `/teams/${fiscalId}`,
      { name: 'Logística', icon: 'scale' },
      owner.accessToken,
    );
    const kept = await patchAuth(
      `/teams/${fiscalId}`,
      { name: 'Logística', icon: '' },
      owner.accessToken,
    );
    const forbidden = await patchAuth(
      `/teams/${fiscalId}`,
      { name: 'Logística', icon: 'phone' },
      admin.accessToken,
    );
    const listed = await getAuth('/teams', owner.accessToken);
    const team = (
      listed.body.items as Array<{ id: string; icon: string }>
    ).find((item) => item.id === fiscalId);
    const prisma = await getPrisma();
    const stored = asType<{ icon: string } | null>(
      await prisma.team.findUnique({
        where: { id: fiscalId },
        select: { icon: true },
      }),
    );
    const omitted = await postAuth(
      '/teams',
      { name: 'Sem escolha' },
      owner.accessToken,
    );

    expect(created.status).toBe(201);
    expect(created.body.icon).toBe('truck');
    expect(stored?.icon).toBe('scale');
    expect(rejected.status).toBe(400);
    expect(rejected.body.error).toBe('INVALID_DEPARTMENT_ICON');
    expect(updated.status).toBe(200);
    expect(updated.body.icon).toBe('scale');
    expect(kept.status).toBe(200);
    expect(kept.body.icon).toBe('scale');
    expect(forbidden.status).toBe(403);
    expect(forbidden.body.error).toBe('NOT_COMPANY_OWNER');
    expect(team?.icon).toBe('scale');
    expect(omitted.status).toBe(201);
    expect(omitted.body.icon).toBe(defaultDepartmentIconKey);
  });
});
