import { describe, expect, it } from 'vitest';
import type { AppError } from '../../core/errors/app-error';
import {
  confirmEmailCode,
  confirmEmailToken,
  issueEmailActivation,
} from './activation';
import type {
  EmailActivationRecord,
  EmailActivationStore,
} from './activation-store';
import type { EmailDelivery } from './email-config';
import type { EmailTransport } from './mailer';

const delivery: EmailDelivery = {
  enabled: true,
  apiKey: 're_test_key',
  from: 'MyroPhone <no-reply@example.com>',
  webUrl: 'https://app.myrophone.test',
};

const user = {
  id: 'user-1',
  email: 'ana@example.com',
  name: 'Ana',
};

function memoryStore(): EmailActivationStore & {
  verifiedAt: Date | null;
} {
  const rows: EmailActivationRecord[] = [];
  const store: EmailActivationStore & { verifiedAt: Date | null } = {
    async insert(input) {
      const row: EmailActivationRecord = {
        id: `row-${rows.length + 1}`,
        ...input,
        usedAt: null,
      };
      rows.push(row);
      return row;
    },
    async findByTokenHash(tokenHash) {
      return rows.find((row) => row.tokenHash === tokenHash) ?? null;
    },
    async findLatestByUserId(userId) {
      const matches = rows.filter((row) => row.userId === userId);
      return matches.at(-1) ?? null;
    },
    async claim(id, usedAt) {
      const row = rows.find((item) => item.id === id && item.usedAt === null);
      if (!row) {
        return false;
      }
      row.usedAt = usedAt;
      return true;
    },
    verifiedAt: null as Date | null,
    async markEmailVerified(_userId: string, verified: Date) {
      store.verifiedAt = verified;
    },
    async deleteById(id) {
      const index = rows.findIndex((row) => row.id === id);
      if (index >= 0) {
        rows.splice(index, 1);
      }
    },
    async retireUnusedExcept(userId, keepId, usedAt) {
      for (const row of rows) {
        if (row.userId === userId && row.id !== keepId && row.usedAt === null) {
          row.usedAt = usedAt;
        }
      }
    },
  };

  return store;
}

function recordingTransport(): EmailTransport & {
  messages: Array<{ html: string; text: string }>;
} {
  const messages: Array<{ html: string; text: string }> = [];
  return {
    messages,
    async send(message) {
      messages.push({ html: message.html, text: message.text });
    },
  };
}

describe('email activation', () => {
  it('skips issuing a token when Resend is disabled', async () => {
    const store = memoryStore();
    const transport = recordingTransport();

    const issued = await issueEmailActivation({
      user,
      store,
      delivery: { enabled: false },
      transport,
      now: new Date('2026-11-24T12:00:00.000Z'),
    });

    expect(issued).toBeNull();
    expect(transport.messages).toHaveLength(0);
    expect(store.verifiedAt).toBeNull();
  });

  it('confirms the email from the one-time link and rejects a reused token', async () => {
    const store = memoryStore();
    const transport = recordingTransport();
    const now = new Date('2026-11-24T12:00:00.000Z');
    const issued = await issueEmailActivation({
      user,
      store,
      delivery,
      transport,
      now,
    });

    expect(issued).not.toBeNull();
    const confirmed = await confirmEmailToken({
      token: issued?.token ?? '',
      store,
      now,
    });

    expect(confirmed.userId).toBe(user.id);
    expect(store.verifiedAt).toEqual(now);
    await expect(
      confirmEmailToken({ token: issued?.token ?? '', store, now }),
    ).rejects.toMatchObject({
      code: 'EMAIL_TOKEN_USED',
    } satisfies Partial<AppError>);
  });

  it('rejects an expired activation token without verifying the email', async () => {
    const store = memoryStore();
    const issued = await issueEmailActivation({
      user,
      store,
      delivery,
      transport: recordingTransport(),
      now: new Date('2026-11-24T12:00:00.000Z'),
    });

    await expect(
      confirmEmailToken({
        token: issued?.token ?? '',
        store,
        now: new Date('2026-11-24T13:00:00.000Z'),
      }),
    ).rejects.toMatchObject({ code: 'EMAIL_TOKEN_EXPIRED' });
    expect(store.verifiedAt).toBeNull();
  });

  it('confirms the same email with the numeric code and ignores another user', async () => {
    const store = memoryStore();
    const issued = await issueEmailActivation({
      user,
      store,
      delivery,
      transport: recordingTransport(),
      now: new Date('2026-11-24T12:00:00.000Z'),
    });

    await expect(
      confirmEmailCode({
        userId: 'user-2',
        code: issued?.code ?? '',
        store,
        now: new Date('2026-11-24T12:01:00.000Z'),
      }),
    ).rejects.toMatchObject({ code: 'INVALID_EMAIL_CODE' });

    const confirmed = await confirmEmailCode({
      userId: user.id,
      code: issued?.code ?? '',
      store,
      now: new Date('2026-11-24T12:01:00.000Z'),
    });

    expect(confirmed.userId).toBe(user.id);
    expect(store.verifiedAt).toEqual(new Date('2026-11-24T12:01:00.000Z'));
  });

  it('limits a second activation email inside the cooldown window', async () => {
    const store = memoryStore();
    const transport = recordingTransport();
    const now = new Date('2026-11-24T12:00:00.000Z');

    await issueEmailActivation({
      user,
      store,
      delivery,
      transport,
      now,
    });

    await expect(
      issueEmailActivation({
        user,
        store,
        delivery,
        transport,
        now: new Date('2026-11-24T12:00:30.000Z'),
      }),
    ).rejects.toMatchObject({ code: 'EMAIL_RESEND_LIMIT' });
    expect(transport.messages).toHaveLength(1);
  });
});

describe('activation mail contents', () => {
  it('puts the token only in the configured web app URL', async () => {
    const transport = recordingTransport();
    const issued = await issueEmailActivation({
      user,
      store: memoryStore(),
      delivery,
      transport,
      now: new Date('2026-11-24T12:00:00.000Z'),
    });

    expect(transport.messages[0]?.html).toContain(
      `https://app.myrophone.test/ativar?token=${issued?.token}`,
    );
    expect(transport.messages[0]?.html).not.toContain('https://evil.example');
  });
});
