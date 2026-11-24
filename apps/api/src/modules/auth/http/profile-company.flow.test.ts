import { afterAll, describe, expect, it } from 'vitest';
import { getPrisma } from '../../../core/db/prisma';
import { asType } from '../db-types';
import {
  cleanupAuthTests,
  getAuth,
  patchAuth,
  postAuth,
  postFormAuth,
} from './auth-flow-client';

const password = 'senha-forte';

afterAll(async () => {
  await cleanupAuthTests();
});

async function registerWithCompany(label: string): Promise<{
  email: string;
  accessToken: string;
  refreshToken: string;
  userId: string;
  tenantId: string;
  sessionId: string;
}> {
  const email = `${label}-${crypto.randomUUID()}@auth-test.local`;
  const registered = await postAuth('/auth/register', {
    name: 'Dona Teste',
    phone: '11987654321',
    email,
    password,
  });
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
  const tokens = created.body.tokens as {
    accessToken: string;
    refreshToken: string;
  };

  return {
    email,
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    userId: (created.body.user as { id: string }).id,
    tenantId: (created.body.tenant as { id: string }).id,
    sessionId: created.body.sessionId as string,
  };
}

describe('PATCH /auth/me', () => {
  it('changes name and phone and leaves the email and session alone', async () => {
    const owner = await registerWithCompany('profile');
    const updated = await patchAuth(
      '/auth/me',
      {
        name: '  Novo Nome ',
        phone: ' (11) 98888-7777 ',
        email: 'outro@auth-test.local',
      },
      owner.accessToken,
    );
    const prisma = await getPrisma();
    const stored = asType<{
      email: string;
      name: string;
      phone: string;
    } | null>(
      await prisma.user.findUnique({
        where: { id: owner.userId },
        select: { email: true, name: true, phone: true },
      }),
    );
    const session = asType<{ id: string; tenantId: string | null } | null>(
      await prisma.session.findUnique({
        where: { id: owner.sessionId },
        select: { id: true, tenantId: true },
      }),
    );
    const logs = asType<Array<{ action: string; metadata: unknown }>>(
      await prisma.actionLog.findMany({
        where: { action: 'profile.update', actorUserId: owner.userId },
      }),
    );

    expect(updated.status).toBe(200);
    expect(updated.body.sessionId).toBe(owner.sessionId);
    expect(updated.body.user).toMatchObject({
      email: owner.email,
      name: 'Novo Nome',
      phone: '(11) 98888-7777',
    });
    expect((updated.body.tenant as { id: string }).id).toBe(owner.tenantId);
    expect(stored).toMatchObject({
      email: owner.email,
      name: 'Novo Nome',
      phone: '(11) 98888-7777',
    });
    expect(session).toMatchObject({
      id: owner.sessionId,
      tenantId: owner.tenantId,
    });
    expect(logs).toHaveLength(1);
    expect(JSON.stringify(logs)).not.toContain('X-Amz-');
  });

  it('updates only the signed-in account', async () => {
    const owner = await registerWithCompany('profile-owner');
    const other = await registerWithCompany('profile-other');
    const updated = await patchAuth(
      '/auth/me',
      { name: 'Pessoa Dois', phone: '11911112222' },
      other.accessToken,
    );
    const ownerProfile = await getAuth('/auth/me', owner.accessToken);

    expect(updated.status).toBe(200);
    expect((updated.body.user as { id: string }).id).toBe(other.userId);
    expect(ownerProfile.body.user).toMatchObject({
      id: owner.userId,
      name: 'Dona Teste',
      email: owner.email,
    });
  });
});

describe('owned company management', () => {
  it('lets an owner rename a company and blocks everyone else', async () => {
    const owner = await registerWithCompany('company-edit');
    const member = await postAuth(
      '/users',
      {
        name: 'Pessoa Teste',
        email: `member-${crypto.randomUUID()}@auth-test.local`,
        password,
        roleName: 'USER',
      },
      owner.accessToken,
    );
    const login = await postAuth('/auth/login', {
      email: member.body.email as string,
      password,
    });
    const memberToken = (login.body.tokens as { accessToken: string })
      .accessToken;
    const forbidden = await patchAuth(
      `/companies/${owner.tenantId}`,
      { name: 'Auth Test Invasao', description: 'Nao pode' },
      memberToken,
    );
    const missing = await patchAuth(
      '/companies/tenant-que-nao-existe',
      { name: 'Auth Test Fantasma', description: 'Nao pode' },
      owner.accessToken,
    );
    const updated = await patchAuth(
      `/companies/${owner.tenantId}`,
      { name: ' Auth Test Renomeada ', description: ' Descricao nova ' },
      owner.accessToken,
    );
    const prisma = await getPrisma();
    const stored = asType<{ name: string; description: string | null } | null>(
      await prisma.tenant.findUnique({
        where: { id: owner.tenantId },
        select: { name: true, description: true },
      }),
    );
    const logs = asType<Array<{ action: string }>>(
      await prisma.actionLog.findMany({
        where: { action: 'company.update', entityId: owner.tenantId },
      }),
    );
    const owned = await getAuth('/companies/owned', owner.accessToken);

    expect(forbidden.status).toBe(403);
    expect(forbidden.body.error).toBe('NOT_COMPANY_OWNER');
    expect(missing.status).toBe(403);
    expect(updated.status).toBe(200);
    expect(updated.body).toMatchObject({
      id: owner.tenantId,
      name: 'Auth Test Renomeada',
      description: 'Descricao nova',
    });
    expect(stored).toMatchObject({
      name: 'Auth Test Renomeada',
      description: 'Descricao nova',
    });
    expect(logs).toHaveLength(1);
    expect(owned.body.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: owner.tenantId,
          name: 'Auth Test Renomeada',
          description: 'Descricao nova',
          logoUrl: null,
        }),
      ]),
    );
  });

  it('creates another company for an owner without switching the active one', async () => {
    const owner = await registerWithCompany('company-create');
    const created = await postAuth(
      '/companies',
      { name: ' Auth Test Filial ', description: '' },
      owner.accessToken,
    );
    const profile = await getAuth('/auth/me', owner.accessToken);
    const member = await postAuth(
      '/users',
      {
        name: 'Pessoa Teste',
        email: `create-member-${crypto.randomUUID()}@auth-test.local`,
        password,
        roleName: 'ADMIN',
      },
      owner.accessToken,
    );
    const login = await postAuth('/auth/login', {
      email: member.body.email as string,
      password,
    });
    const blocked = await postAuth(
      '/companies',
      { name: 'Auth Test Bloqueada' },
      (login.body.tokens as { accessToken: string }).accessToken,
    );

    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({
      name: 'Auth Test Filial',
      description: null,
    });
    expect(created.body).not.toHaveProperty('slug', '');
    expect(typeof (created.body as { slug: string }).slug).toBe('string');
    expect((profile.body.tenant as { id: string }).id).toBe(owner.tenantId);
    expect(profile.body.sessionId).toBe(owner.sessionId);
    expect(profile.body.companies).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'Auth Test Filial' }),
        expect.objectContaining({ id: owner.tenantId }),
      ]),
    );
    expect(blocked.status).toBe(403);
  });

  it('rejects a logo upload from someone who does not own the company', async () => {
    const owner = await registerWithCompany('logo-guard');
    const member = await postAuth(
      '/users',
      {
        name: 'Pessoa Teste',
        email: `logo-member-${crypto.randomUUID()}@auth-test.local`,
        password,
        roleName: 'ADMIN',
      },
      owner.accessToken,
    );
    const login = await postAuth('/auth/login', {
      email: member.body.email as string,
      password,
    });
    const form = new FormData();
    form.set('purpose', 'LOGO');
    form.set('tenantId', owner.tenantId);
    form.set(
      'file',
      new File([Uint8Array.from([1, 2, 3, 4])], 'logo.png', {
        type: 'image/png',
      }),
    );
    const uploaded = await postFormAuth(
      '/files',
      form,
      (login.body.tokens as { accessToken: string }).accessToken,
    );

    expect(uploaded.status).toBe(403);
    expect(uploaded.body.error).toBe('NOT_COMPANY_OWNER');
  });
});
