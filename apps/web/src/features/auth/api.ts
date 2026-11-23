import { getApi } from '../../api/client';
import { authErrorMessage, type AuthProfile, type AuthSession } from './types';

export class AuthRequestError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'AuthRequestError';
    this.code = code;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isAuthProfile(value: unknown): value is AuthProfile {
  if (!isRecord(value) || !isRecord(value.user) || !isRecord(value.tenant)) {
    return false;
  }

  return (
    typeof value.sessionId === 'string' &&
    typeof value.membershipId === 'string' &&
    typeof value.user.id === 'string' &&
    typeof value.user.email === 'string' &&
    typeof value.tenant.id === 'string' &&
    typeof value.tenant.slug === 'string' &&
    typeof value.tenant.name === 'string' &&
    typeof value.role === 'string' &&
    Array.isArray(value.permissions) &&
    Array.isArray(value.teams) &&
    Array.isArray(value.teamPermissions)
  );
}

function isTimestamp(value: unknown): value is string | Date {
  return typeof value === 'string' || value instanceof Date;
}

function isAuthSession(value: unknown): value is AuthSession {
  if (!isRecord(value)) {
    return false;
  }

  const tokens = value.tokens;

  if (!isRecord(tokens) || !isAuthProfile(value)) {
    return false;
  }

  return (
    typeof tokens.accessToken === 'string' &&
    typeof tokens.refreshToken === 'string' &&
    typeof tokens.accessTokenTtl === 'string' &&
    isTimestamp(tokens.refreshTokenExpiresAt)
  );
}

export function toAuthRequestError(error: unknown): AuthRequestError {
  if (!isRecord(error) || !isRecord(error.value)) {
    return new AuthRequestError(
      'UNKNOWN',
      'Não foi possível falar com a API.',
    );
  }

  const code = typeof error.value.error === 'string' ? error.value.error : 'UNKNOWN';
  const fallback =
    typeof error.value.message === 'string'
      ? error.value.message
      : 'Não foi possível concluir a autenticação.';

  return new AuthRequestError(code, authErrorMessage(code, fallback));
}

function readSession(data: unknown): AuthSession {
  const refreshTokenExpiresAt =
    isRecord(data) && isRecord(data.tokens)
      ? data.tokens.refreshTokenExpiresAt
      : undefined;

  if (!isAuthSession(data)) {
    throw new AuthRequestError(
      'INVALID_RESPONSE',
      'A API devolveu uma sessão incompleta.',
    );
  }

  return {
    ...data,
    tokens: {
      ...data.tokens,
      refreshTokenExpiresAt:
        refreshTokenExpiresAt instanceof Date
          ? refreshTokenExpiresAt.toISOString()
          : data.tokens.refreshTokenExpiresAt,
    },
  };
}

function readProfile(data: unknown): AuthProfile {
  if (!isAuthProfile(data)) {
    throw new AuthRequestError(
      'INVALID_RESPONSE',
      'A API devolveu um perfil incompleto.',
    );
  }

  return data;
}

export async function loginRequest(input: {
  email: string;
  password: string;
  tenantSlug?: string;
}): Promise<AuthSession> {
  const body = input.tenantSlug
    ? {
        email: input.email,
        password: input.password,
        tenantSlug: input.tenantSlug,
      }
    : {
        email: input.email,
        password: input.password,
      };
  const { data, error } = await getApi().auth.login.post(body);

  if (error) {
    throw toAuthRequestError(error);
  }

  return readSession(data);
}

export async function registerRequest(input: {
  tenantName: string;
  name: string;
  email: string;
  password: string;
}): Promise<AuthSession> {
  const { data, error } = await getApi().auth.register.post(input);

  if (error) {
    throw toAuthRequestError(error);
  }

  return readSession(data);
}

export async function refreshRequest(refreshToken: string): Promise<AuthSession> {
  const { data, error } = await getApi().auth.refresh.post({ refreshToken });

  if (error) {
    throw toAuthRequestError(error);
  }

  return readSession(data);
}

export async function logoutRequest(refreshToken: string): Promise<void> {
  await getApi().auth.logout.post({ refreshToken });
}

export async function profileRequest(): Promise<
  AuthProfile | 'unauthorized'
> {
  const { data, error, status } = await getApi().auth.me.get();

  if (error) {
    if (status === 401) {
      return 'unauthorized';
    }

    throw toAuthRequestError(error);
  }

  return readProfile(data);
}
