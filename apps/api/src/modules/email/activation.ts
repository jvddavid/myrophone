import { timingSafeEqual } from 'node:crypto';
import { AppError } from '../../core/errors/app-error';
import { hashOpaqueToken } from '../auth/token';
import {
  EMAIL_ACTIVATION_TTL_MS,
  EMAIL_RESEND_COOLDOWN_MS,
} from './activation-link';
import type { EmailActivationStore } from './activation-store';
import type { EmailDelivery } from './email-config';
import { deliverActivationEmail, type EmailTransport } from './mailer';

export interface ActivationUser {
  id: string;
  email: string;
  name: string;
}

function activationError(
  statusCode: number,
  code: string,
  message: string,
): AppError {
  return new AppError({ statusCode, code, message });
}

function sameHash(left: string, right: string): boolean {
  const leftBytes = Buffer.from(left);
  const rightBytes = Buffer.from(right);

  if (leftBytes.length !== rightBytes.length) {
    return false;
  }

  return timingSafeEqual(leftBytes, rightBytes);
}

function createActivationToken(): string {
  return `${crypto.randomUUID()}.${crypto.randomUUID()}`;
}

function createActivationCode(): string {
  const bytes = new Uint32Array(1);
  crypto.getRandomValues(bytes);
  return String(bytes[0] % 1_000_000).padStart(6, '0');
}

export async function issueEmailActivation(input: {
  user: ActivationUser;
  store: EmailActivationStore;
  delivery: EmailDelivery;
  transport: EmailTransport;
  now?: Date;
}): Promise<{ token: string; code: string } | null> {
  if (!input.delivery.enabled) {
    return null;
  }

  const now = input.now ?? new Date();
  const latest = await input.store.findLatestByUserId(input.user.id);

  if (
    latest &&
    latest.usedAt === null &&
    latest.expiresAt.getTime() > now.getTime() &&
    now.getTime() - latest.createdAt.getTime() < EMAIL_RESEND_COOLDOWN_MS
  ) {
    throw activationError(
      429,
      'EMAIL_RESEND_LIMIT',
      'Wait a minute before requesting another activation email.',
    );
  }

  const token = createActivationToken();
  const code = createActivationCode();
  const [tokenHash, codeHash] = await Promise.all([
    hashOpaqueToken(token),
    hashOpaqueToken(code),
  ]);
  const created = await input.store.insert({
    userId: input.user.id,
    tokenHash,
    codeHash,
    expiresAt: new Date(now.getTime() + EMAIL_ACTIVATION_TTL_MS),
    createdAt: now,
  });

  try {
    await deliverActivationEmail({
      delivery: input.delivery,
      transport: input.transport,
      to: input.user.email,
      name: input.user.name,
      token,
      code,
    });
  } catch (error) {
    await input.store.deleteById(created.id);
    throw error;
  }

  await input.store.retireUnusedExcept(input.user.id, created.id, now);
  return { token, code };
}

export async function confirmEmailToken(input: {
  token: string;
  store: EmailActivationStore;
  now?: Date;
}): Promise<{ userId: string }> {
  const now = input.now ?? new Date();
  const tokenHash = await hashOpaqueToken(input.token);
  const record = await input.store.findByTokenHash(tokenHash);

  if (!record) {
    throw activationError(
      400,
      'INVALID_EMAIL_TOKEN',
      'Email activation token is invalid.',
    );
  }

  if (record.usedAt) {
    throw activationError(
      400,
      'EMAIL_TOKEN_USED',
      'Email activation token was already used.',
    );
  }

  if (record.expiresAt.getTime() <= now.getTime()) {
    throw activationError(
      400,
      'EMAIL_TOKEN_EXPIRED',
      'Email activation token has expired.',
    );
  }

  const claimed = await input.store.claim(record.id, now);

  if (!claimed) {
    throw activationError(
      400,
      'EMAIL_TOKEN_USED',
      'Email activation token was already used.',
    );
  }

  await input.store.markEmailVerified(record.userId, now);
  return { userId: record.userId };
}

export async function confirmEmailCode(input: {
  userId: string;
  code: string;
  store: EmailActivationStore;
  now?: Date;
}): Promise<{ userId: string }> {
  const now = input.now ?? new Date();
  const normalized = input.code.trim();
  const record = await input.store.findLatestByUserId(input.userId);

  if (!record || !/^\d{6}$/.test(normalized)) {
    throw activationError(
      400,
      'INVALID_EMAIL_CODE',
      'Email activation code is invalid.',
    );
  }

  const codeHash = await hashOpaqueToken(normalized);

  if (!sameHash(codeHash, record.codeHash)) {
    throw activationError(
      400,
      'INVALID_EMAIL_CODE',
      'Email activation code is invalid.',
    );
  }

  if (record.usedAt) {
    throw activationError(
      400,
      'EMAIL_CODE_USED',
      'Email activation code was already used.',
    );
  }

  if (record.expiresAt.getTime() <= now.getTime()) {
    throw activationError(
      400,
      'EMAIL_CODE_EXPIRED',
      'Email activation code has expired.',
    );
  }

  const claimed = await input.store.claim(record.id, now);

  if (!claimed) {
    throw activationError(
      400,
      'EMAIL_CODE_USED',
      'Email activation code was already used.',
    );
  }

  await input.store.markEmailVerified(record.userId, now);
  return { userId: record.userId };
}
