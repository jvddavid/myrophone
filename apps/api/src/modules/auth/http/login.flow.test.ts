import { afterAll, describe, expect, it } from 'vitest';
import { getPrisma } from '../../../core/db/prisma';
import { asType } from '../db-types';
import { cleanupAuthTests, postAuth } from './auth-flow-client';

const password = 'senha-forte';

afterAll(async () => {
  await cleanupAuthTests();
});

async function register(email: string): Promise<void> {
  const response = await postAuth('/auth/register', {
    name: 'Ana Teste',
    phone: '11987654321',
    email,
    password,
  });

  expect(response.status).toBe(201);
}

describe('POST /auth/login', () => {
  it('logs in without a company field and keeps the account session', async () => {
    const email = `login-empty-${crypto.randomUUID()}@auth-test.local`;
    await register(email);

    const response = await postAuth('/auth/login', { email, password });

    expect(response.status).toBe(200);
    expect(response.body.tenant).toBeNull();
    expect(response.body.companies).toEqual([]);
  });

  it('uses the saved company and otherwise the oldest active company', async () => {
    const email = `login-many-${crypto.randomUUID()}@auth-test.local`;
    await register(email);
    const prisma = await getPrisma();
    const user = asType<{ id: string }>(
      await prisma.user.findUnique({ where: { email } }),
    );
    const older = asType<{ id: string }>(
      await prisma.tenant.create({
        data: { name: 'Auth Test Older', slug: `auth-test-older-${crypto.randomUUID()}` },
      }),
    );
    const newer = asType<{ id: string }>(
      await prisma.tenant.create({
        data: { name: 'Auth Test Newer', slug: `auth-test-newer-${crypto.randomUUID()}` },
      }),
    );

    for (const tenant of [
      { id: older.id, createdAt: new Date('2020-01-01T00:00:00.000Z') },
      { id: newer.id, createdAt: new Date('2024-01-01T00:00:00.000Z') },
    ]) {
      const role = asType<{ id: string }>(
        await prisma.role.create({
          data: { tenantId: tenant.id, name: 'USER', isSystem: true },
        }),
      );
      await prisma.membership.create({
        data: {
          tenantId: tenant.id,
          userId: user.id,
          roleId: role.id,
          status: 'ACTIVE',
          createdAt: tenant.createdAt,
        },
      });
    }

    const firstLogin = await postAuth('/auth/login', { email, password });
    const firstTenant = firstLogin.body.tenant as { id: string };

    await prisma.user.update({
      where: { id: user.id },
      data: { lastTenantId: newer.id },
    });
    const savedLogin = await postAuth('/auth/login', { email, password });

    await prisma.membership.update({
      where: { tenantId_userId: { tenantId: newer.id, userId: user.id } },
      data: { status: 'SUSPENDED' },
    });
    const fallbackLogin = await postAuth('/auth/login', { email, password });

    expect(firstTenant.id).toBe(older.id);
    expect((savedLogin.body.tenant as { id: string }).id).toBe(newer.id);
    expect((fallbackLogin.body.tenant as { id: string }).id).toBe(older.id);
    expect(savedLogin.body.companies).toEqual([
      expect.objectContaining({ id: newer.id, name: 'Auth Test Newer' }),
      expect.objectContaining({ id: older.id, name: 'Auth Test Older' }),
    ]);
  });
});
