import { app } from '../../../app';
import { getPrisma } from '../../../core/db/prisma';

export async function postAuth(
  path: string,
  body: unknown,
  accessToken?: string,
): Promise<{ status: number; body: Record<string, unknown> }> {
  const headers: Record<string, string> = {
    'content-type': 'application/json',
  };

  if (accessToken) {
    headers.authorization = `Bearer ${accessToken}`;
  }

  const response = await app.handle(
    new Request(`http://localhost${path}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    }),
  );

  return {
    status: response.status,
    body: (await response.json()) as Record<string, unknown>,
  };
}

export async function getAuth(
  path: string,
  accessToken: string,
): Promise<{ status: number; body: Record<string, unknown> }> {
  const response = await app.handle(
    new Request(`http://localhost${path}`, {
      headers: { authorization: `Bearer ${accessToken}` },
    }),
  );

  return {
    status: response.status,
    body: (await response.json()) as Record<string, unknown>,
  };
}

export async function deleteAuth(
  path: string,
  accessToken: string,
): Promise<{ status: number; body: Record<string, unknown> }> {
  const response = await app.handle(
    new Request(`http://localhost${path}`, {
      method: 'DELETE',
      headers: { authorization: `Bearer ${accessToken}` },
    }),
  );

  return {
    status: response.status,
    body: (await response.json()) as Record<string, unknown>,
  };
}

export async function patchAuth(
  path: string,
  body: unknown,
  accessToken: string,
): Promise<{ status: number; body: Record<string, unknown> }> {
  const response = await app.handle(
    new Request(`http://localhost${path}`, {
      method: 'PATCH',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(body),
    }),
  );

  return {
    status: response.status,
    body: (await response.json()) as Record<string, unknown>,
  };
}

export async function postFormAuth(
  path: string,
  form: FormData,
  accessToken: string,
): Promise<{ status: number; body: Record<string, unknown> }> {
  const headers = new Headers();
  headers.set('authorization', `Bearer ${accessToken}`);
  const response = await app.handle(
    new Request(`http://localhost${path}`, {
      method: 'POST',
      headers,
      body: form,
    }),
  );

  return {
    status: response.status,
    body: (await response.json()) as Record<string, unknown>,
  };
}

export async function putAuth(
  path: string,
  body: unknown,
  accessToken: string,
): Promise<{ status: number; body: Record<string, unknown> }> {
  const response = await app.handle(
    new Request(`http://localhost${path}`, {
      method: 'PUT',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(body),
    }),
  );

  return {
    status: response.status,
    body: (await response.json()) as Record<string, unknown>,
  };
}

export async function cleanupAuthTests(): Promise<void> {
  const prisma = await getPrisma();
  const users = (await prisma.user.findMany({
    where: { email: { endsWith: '@auth-test.local' } },
    select: { id: true },
  })) as Array<{ id: string }>;
  const userIds = users.map((user) => user.id);

  await prisma.session.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.membership.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  await prisma.tenant.deleteMany({
    where: { name: { startsWith: 'Auth Test' } },
  });
}
