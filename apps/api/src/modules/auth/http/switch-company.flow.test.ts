import { afterAll, describe, expect, it } from 'vitest';
import { getPrisma } from '../../../core/db/prisma';
import { asType } from '../db-types';
import { cleanupAuthTests, postAuth } from './auth-flow-client';

afterAll(async () => {
  await cleanupAuthTests();
});

describe('POST /auth/tenant', () => {
  it('switches to another active company and keeps the refresh token', async () => {
    const email = `switch-${crypto.randomUUID()}@auth-test.local`;
    const registered = await postAuth('/auth/register', {
      name: 'Ana Teste',
      phone: '11987654321',
      email,
      password: 'senha-forte',
    });
    const tokens = registered.body.tokens as {
      accessToken: string;
      refreshToken: string;
    };
    const first = await postAuth(
      '/auth/companies',
      {
        name: 'Auth Test One',
        description: 'Primeira empresa de teste.',
        refreshToken: tokens.refreshToken,
      },
      tokens.accessToken,
    );
    const current = first.body.tokens as {
      accessToken: string;
      refreshToken: string;
    };
    const prisma = await getPrisma();
    const user = asType<{ id: string }>(
      await prisma.user.findUnique({ where: { email } }),
    );
    const second = asType<{ id: string }>(
      await prisma.tenant.create({
        data: {
          name: 'Auth Test Two',
          slug: `auth-test-two-${crypto.randomUUID()}`,
        },
      }),
    );
    const role = asType<{ id: string }>(
      await prisma.role.create({
        data: { tenantId: second.id, name: 'USER', isSystem: true },
      }),
    );
    await prisma.membership.create({
      data: {
        tenantId: second.id,
        userId: user.id,
        roleId: role.id,
        status: 'ACTIVE',
      },
    });

    const switched = await postAuth(
      '/auth/tenant',
      { tenantId: second.id, refreshToken: current.refreshToken },
      current.accessToken,
    );
    const switchedTokens = switched.body.tokens as {
      accessToken: string;
      refreshToken: string;
    };
    const missing = await postAuth(
      '/auth/tenant',
      { tenantId: 'missing-company', refreshToken: current.refreshToken },
      switchedTokens.accessToken,
    );

    expect(switched.status).toBe(200);
    expect(switched.body.sessionId).toBe(first.body.sessionId);
    expect(switchedTokens.refreshToken).toBe(current.refreshToken);
    expect((switched.body.tenant as { id: string }).id).toBe(second.id);
    expect(switched.body.role).toBe('USER');
    expect(missing.status).toBe(403);
    expect(missing.body.error).toBe('MEMBERSHIP_NOT_ACTIVE');
  });
});
