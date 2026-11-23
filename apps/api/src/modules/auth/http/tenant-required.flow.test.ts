import { afterAll, describe, expect, it } from 'vitest';
import { app } from '../../../app';
import { cleanupAuthTests, postAuth } from './auth-flow-client';

afterAll(async () => {
  await cleanupAuthTests();
});

describe('tenant-scoped routes', () => {
  it('rejects a session that has no company', async () => {
    const email = `jobs-${crypto.randomUUID()}@auth-test.local`;
    const registered = await postAuth('/auth/register', {
      name: 'Ana Teste',
      phone: '11987654321',
      email,
      password: 'senha-forte',
    });
    const token = (registered.body.tokens as { accessToken: string }).accessToken;
    const response = await app.handle(
      new Request('http://localhost/jobs/tenant-hierarchy-export', {
        method: 'POST',
        headers: { authorization: `Bearer ${token}` },
      }),
    );
    const body = (await response.json()) as { error?: string };

    expect(response.status).toBe(403);
    expect(body.error).toBe('NO_ACTIVE_TENANT');
  });
});
