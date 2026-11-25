import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import { getPrisma } from '../../../core/db/prisma';
import { type OutboundEmail, useEmailTransport } from '../../email/mailer';
import { asType } from '../db-types';
import {
  cleanupAuthTests,
  getAuth,
  patchAuth,
  postAuth,
} from './auth-flow-client';

const password = 'senha-forte';
const sent: OutboundEmail[] = [];

beforeEach(() => {
  sent.length = 0;
  process.env.RESEND_API_KEY = 're_test_key';
  process.env.EMAIL_FROM = 'MyroPhone <no-reply@example.com>';
  process.env.APP_WEB_URL = 'http://127.0.0.1:5173';
  useEmailTransport({
    async send(message) {
      sent.push(message);
    },
  });
});

afterEach(() => {
  delete process.env.RESEND_API_KEY;
  delete process.env.EMAIL_FROM;
  delete process.env.APP_WEB_URL;
  useEmailTransport(undefined);
});

afterAll(async () => {
  await cleanupAuthTests();
});

async function register(email: string) {
  const created = await postAuth('/auth/register', {
    name: 'Ana Teste',
    phone: '11987654321',
    email,
    password,
  });
  const tokens = created.body.tokens as {
    accessToken: string;
    refreshToken: string;
  };

  return { created, tokens };
}

function tokenFromEmail(message: OutboundEmail | undefined): string {
  const match = message?.html.match(/token=([^"&\s]+)/);
  return match?.[1] ? decodeURIComponent(match[1]) : '';
}

function codeFromEmail(message: OutboundEmail | undefined): string {
  return (
    message?.text
      .split('\n')
      .map((line) => line.trim())
      .find((line) => /^\d{6}$/.test(line)) ?? ''
  );
}

describe('email activation delivery', () => {
  it('does not send or block the product when Resend is not configured', async () => {
    delete process.env.RESEND_API_KEY;
    delete process.env.EMAIL_FROM;
    delete process.env.APP_WEB_URL;

    const email = `activation-off-${crypto.randomUUID()}@auth-test.local`;
    const { created, tokens } = await register(email);
    const profile = await patchAuth(
      '/auth/me',
      { name: 'Ana Teste', phone: '11987654321' },
      tokens.accessToken,
    );

    expect(created.status).toBe(201);
    expect(created.body.user).toMatchObject({ emailVerifiedAt: null });
    expect(sent).toHaveLength(0);
    expect(profile.status).toBe(200);
    expect(profile.body.error).not.toBe('EMAIL_NOT_VERIFIED');
  });

  it('sends the activation email on register and blocks the product until the link is confirmed', async () => {
    const email = `activation-link-${crypto.randomUUID()}@auth-test.local`;
    const { created, tokens } = await register(email);
    const blocked = await patchAuth(
      '/auth/me',
      { name: 'Ana Teste', phone: '11987654321' },
      tokens.accessToken,
    );
    const readable = await getAuth('/auth/me', tokens.accessToken);
    const token = tokenFromEmail(sent[0]);
    const confirmed = await postAuth('/auth/email/confirm', { token });
    const reused = await postAuth('/auth/email/confirm', { token });
    const prisma = await getPrisma();
    const user = asType<{ emailVerifiedAt: Date | null } | null>(
      await prisma.user.findUnique({ where: { email } }),
    );
    const opened = await patchAuth(
      '/auth/me',
      { name: 'Ana Teste', phone: '11987654321' },
      (confirmed.body.tokens as { accessToken: string }).accessToken,
    );

    expect(created.status).toBe(201);
    expect(created.body.user).toMatchObject({ emailVerifiedAt: null });
    expect(created.body.emailActivationRequired).toBe(true);
    expect(sent).toHaveLength(1);
    expect(sent[0]?.to).toBe(email);
    expect(sent[0]?.from).toBe('MyroPhone <no-reply@example.com>');
    expect(sent[0]?.subject).toBe('Ative seu e-mail no MyroPhone');
    expect(sent[0]?.html).toContain(`token=${token}`);
    expect(blocked.status).toBe(403);
    expect(blocked.body.error).toBe('EMAIL_NOT_VERIFIED');
    expect(readable.status).toBe(200);
    expect(confirmed.status).toBe(200);
    expect(confirmed.body.user).toMatchObject({
      email,
      emailVerifiedAt: expect.any(String),
    });
    expect(user?.emailVerifiedAt).toBeInstanceOf(Date);
    expect(reused.status).toBe(400);
    expect(reused.body.error).toBe('EMAIL_TOKEN_USED');
    expect(opened.status).toBe(200);
  });

  it('confirms the email with the numeric code sent in the same message', async () => {
    const email = `activation-code-${crypto.randomUUID()}@auth-test.local`;
    const { tokens } = await register(email);
    const code = codeFromEmail(sent[0]);
    const other = await postAuth(
      '/auth/email/code',
      { code },
      (
        await register(
          `activation-other-${crypto.randomUUID()}@auth-test.local`,
        )
      ).tokens.accessToken,
    );
    const confirmed = await postAuth(
      '/auth/email/code',
      { code },
      tokens.accessToken,
    );

    expect(code).toMatch(/^\d{6}$/);
    expect(other.status).toBe(400);
    expect(other.body.error).toBe('INVALID_EMAIL_CODE');
    expect(confirmed.status).toBe(200);
    expect(confirmed.body.user).toMatchObject({
      email,
      emailVerifiedAt: expect.any(String),
    });
  });

  it('rejects an expired activation token', async () => {
    const email = `activation-expired-${crypto.randomUUID()}@auth-test.local`;
    await register(email);
    const token = tokenFromEmail(sent[0]);
    const prisma = await getPrisma();
    const storedUser = asType<{ id: string } | null>(
      await prisma.user.findUnique({ where: { email } }),
    );
    await prisma.emailVerification.updateMany({
      where: { userId: storedUser?.id ?? '' },
      data: { expiresAt: new Date('2020-01-01T00:00:00.000Z') },
    });
    const expired = await postAuth('/auth/email/confirm', { token });
    const user = asType<{ emailVerifiedAt: Date | null } | null>(
      await prisma.user.findUnique({ where: { email } }),
    );

    expect(expired.status).toBe(400);
    expect(expired.body.error).toBe('EMAIL_TOKEN_EXPIRED');
    expect(user?.emailVerifiedAt).toBeNull();
  });

  it('does not keep the account when the activation email cannot be sent', async () => {
    useEmailTransport({
      async send() {
        throw new Error('smtp down');
      },
    });
    const email = `activation-fail-${crypto.randomUUID()}@auth-test.local`;
    const created = await postAuth('/auth/register', {
      name: 'Ana Teste',
      phone: '11987654321',
      email,
      password,
    });
    const prisma = await getPrisma();
    const users = (await prisma.user.findMany({
      where: { email },
    })) as unknown[];

    expect(created.status).toBe(502);
    expect(created.body.error).toBe('EMAIL_DELIVERY_FAILED');
    expect(users).toHaveLength(0);
  });

  it('throttles a second activation email inside the existing cooldown', async () => {
    const email = `activation-resend-${crypto.randomUUID()}@auth-test.local`;
    const { tokens } = await register(email);
    const again = await postAuth('/auth/email/resend', {}, tokens.accessToken);

    expect(sent).toHaveLength(1);
    expect(again.status).toBe(429);
    expect(again.body.error).toBe('EMAIL_RESEND_LIMIT');
  });
});
