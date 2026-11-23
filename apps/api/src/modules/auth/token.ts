import { jwtVerify, SignJWT } from 'jose';
import { env } from '../../core/config/env';

const secret = new TextEncoder().encode(env.JWT_SECRET);

export interface AccessTokenPayload {
  sub: string;
  sid: string;
  tenantId: string;
  email: string;
  exp?: number;
  iat?: number;
}

export async function signAccessToken(payload: {
  userId: string;
  sessionId: string;
  tenantId: string;
  email: string;
}): Promise<string> {
  return new SignJWT({
    sid: payload.sessionId,
    tenantId: payload.tenantId,
    email: payload.email,
  })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setSubject(payload.userId)
    .setIssuedAt()
    .setExpirationTime(env.JWT_ACCESS_TTL)
    .sign(secret);
}

export async function verifyAccessToken(
  token: string,
): Promise<AccessTokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secret);
    const claimBag = payload as Record<string, unknown>;

    const sub = payload.sub;
    const sid = claimBag.sid;
    const tenantId = claimBag.tenantId;
    const email = claimBag.email;

    if (
      typeof sub !== 'string' ||
      typeof sid !== 'string' ||
      typeof tenantId !== 'string' ||
      typeof email !== 'string'
    ) {
      return null;
    }

    return {
      sub,
      sid,
      tenantId,
      email,
      exp: payload.exp,
      iat: payload.iat,
    };
  } catch {
    return null;
  }
}

export async function hashOpaqueToken(value: string): Promise<string> {
  const data = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', data);

  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

export function generateRefreshToken(): string {
  return `${crypto.randomUUID()}.${crypto.randomUUID()}`;
}

export function parseBearerToken(headerValue: string | null): string | null {
  if (!headerValue) {
    return null;
  }

  if (!headerValue.startsWith('Bearer ')) {
    return null;
  }

  const token = headerValue.slice('Bearer '.length).trim();
  return token.length > 0 ? token : null;
}
