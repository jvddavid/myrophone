import { afterAll, describe, expect, it } from 'vitest';
import { getPrisma } from '../../../core/db/prisma';
import { asType } from '../db-types';
import { cleanupAuthTests, getAuth, postAuth } from './auth-flow-client';

afterAll(async () => {
  await cleanupAuthTests();
});

describe('POST /auth/companies', () => {
  it('creates the first company on the same session and rejects a second one', async () => {
    const email = `company-${crypto.randomUUID()}@auth-test.local`;
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

    const created = await postAuth(
      '/auth/companies',
      {
        name: 'Auth Test Acme',
        description: 'Assistência e venda de celulares.',
        logoUrl: 'https://cdn.example/acme.png',
        refreshToken: tokens.refreshToken,
      },
      tokens.accessToken,
    );
    const nextTokens = created.body.tokens as {
      accessToken: string;
      refreshToken: string;
    };
    const profile = await getAuth('/auth/me', nextTokens.accessToken);
    const again = await postAuth(
      '/auth/companies',
      {
        name: 'Auth Test Other',
        description: 'Segunda empresa, que não deve ser criada.',
        refreshToken: nextTokens.refreshToken,
      },
      nextTokens.accessToken,
    );
    const prisma = await getPrisma();
    const sessions = asType<Array<{ id: string }>>(
      await prisma.session.findMany({
        where: { user: { email }, revokedAt: null },
      }),
    );

    expect(created.status).toBe(200);
    expect(created.body.sessionId).toBe(registered.body.sessionId);
    expect(nextTokens.refreshToken).toBe(tokens.refreshToken);
    expect(nextTokens.accessToken).not.toBe(tokens.accessToken);
    expect(created.body.role).toBe('OWNER');
    expect(created.body.tenant).toMatchObject({
      name: 'Auth Test Acme',
      description: 'Assistência e venda de celulares.',
      logoUrl: 'https://cdn.example/acme.png',
    });
    expect(created.body.companies).toEqual([
      expect.objectContaining({
        name: 'Auth Test Acme',
        description: 'Assistência e venda de celulares.',
        logoUrl: 'https://cdn.example/acme.png',
      }),
    ]);
    expect(profile.body.tenant).toMatchObject({
      name: 'Auth Test Acme',
      description: 'Assistência e venda de celulares.',
      logoUrl: 'https://cdn.example/acme.png',
    });
    expect(again.status).toBe(403);
    expect(again.body.error).toBe('COMPANY_CREATE_UNAVAILABLE');
    expect(sessions).toHaveLength(1);
  });
});
