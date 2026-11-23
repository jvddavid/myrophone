import { afterAll, describe, expect, it } from 'vitest';
import { getPrisma } from '../../../core/db/prisma';
import { cleanupAuthTests, getAuth, postAuth } from './auth-flow-client';

const email = `register-${crypto.randomUUID()}@auth-test.local`;
const password = 'senha-forte';

afterAll(async () => {
  await cleanupAuthTests();
});

describe('POST /auth/register', () => {
  it('creates an account session without a company', async () => {
    const created = await postAuth('/auth/register', {
      name: 'Ana Teste',
      phone: '(11) 98765-4321',
      email,
      password,
    });
    const tokens = created.body.tokens as { accessToken: string; refreshToken: string };
    const profile = await getAuth('/auth/me', tokens.accessToken);
    const refreshed = await postAuth('/auth/refresh', {
      refreshToken: tokens.refreshToken,
    });
    const prisma = await getPrisma();
    const memberships = (await prisma.membership.findMany({
      where: { user: { email } },
    })) as unknown[];

    expect(created.status).toBe(201);
    expect(created.body.tenant).toBeNull();
    expect(created.body.membershipId).toBeNull();
    expect(created.body.role).toBeNull();
    expect(created.body.companies).toEqual([]);
    expect(created.body.user).toMatchObject({
      email,
      name: 'Ana Teste',
      phone: '(11) 98765-4321',
      avatarUrl: null,
      emailVerifiedAt: null,
    });
    expect(profile.status).toBe(200);
    expect(profile.body.tenant).toBeNull();
    expect(refreshed.status).toBe(200);
    expect(refreshed.body.tenant).toBeNull();
    expect(memberships).toHaveLength(0);
  });

  it('rejects a duplicate email and an invalid phone', async () => {
    const duplicate = await postAuth('/auth/register', {
      name: 'Ana Teste',
      phone: '11987654321',
      email,
      password,
    });
    const phone = await postAuth('/auth/register', {
      name: 'Ana Teste',
      phone: 'telefone!!',
      email: `phone-${crypto.randomUUID()}@auth-test.local`,
      password,
    });

    expect(duplicate.status).toBe(409);
    expect(duplicate.body.error).toBe('EMAIL_IN_USE');
    expect(phone.status).toBe(400);
    expect(phone.body.error).toBe('VALIDATION_ERROR');
  });

  it('rejects a name shorter than 2 characters after trim', async () => {
    const shortEmail = `short-${crypto.randomUUID()}@auth-test.local`;
    const response = await postAuth('/auth/register', {
      name: '  a ',
      phone: '11987654321',
      email: shortEmail,
      password,
    });
    const prisma = await getPrisma();
    const stored = (await prisma.user.findMany({
      where: { email: shortEmail },
    })) as unknown[];

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('VALIDATION_ERROR');
    expect(stored).toHaveLength(0);
  });
});
