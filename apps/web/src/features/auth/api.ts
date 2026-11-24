import { getApi } from '../../api/client';
import type { CompanyIdentity } from './company-profile';
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

function isCompany(value: unknown): value is CompanyIdentity {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.slug === 'string' &&
    typeof value.name === 'string' &&
    isNullableString(value.description) &&
    isNullableString(value.logoUrl)
  );
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === 'string';
}

function isAuthProfile(value: unknown): value is AuthProfile {
  if (!isRecord(value) || !isRecord(value.user)) {
    return false;
  }

  return (
    typeof value.sessionId === 'string' &&
    isNullableString(value.membershipId) &&
    typeof value.user.id === 'string' &&
    typeof value.user.email === 'string' &&
    isNullableString(value.user.phone) &&
    isNullableString(value.user.avatarUrl) &&
    (value.user.emailVerifiedAt === null ||
      isTimestamp(value.user.emailVerifiedAt)) &&
    (value.tenant === null || isCompany(value.tenant)) &&
    Array.isArray(value.companies) &&
    value.companies.every(isCompany) &&
    isNullableString(value.role) &&
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

function readOwnsCompany(data: AuthProfile): boolean {
  const value = (data as { ownsCompany?: unknown }).ownsCompany;

  if (typeof value === 'boolean') {
    return value;
  }

  return data.role === 'OWNER';
}

function readProfile(data: unknown): AuthProfile {
  if (!isAuthProfile(data)) {
    throw new AuthRequestError(
      'INVALID_RESPONSE',
      'A API devolveu um perfil incompleto.',
    );
  }

  return {
    ...data,
    ownsCompany: readOwnsCompany(data),
  };
}

export async function loginRequest(input: {
  email: string;
  password: string;
}): Promise<AuthSession> {
  const { data, error } = await getApi().auth.login.post({
    email: input.email,
    password: input.password,
  });

  if (error) {
    throw toAuthRequestError(error);
  }

  return readSession(data);
}

export async function registerRequest(input: {
  name: string;
  phone: string;
  email: string;
  password: string;
}): Promise<AuthSession> {
  const { data, error } = await getApi().auth.register.post({
    name: input.name,
    phone: input.phone,
    email: input.email,
    password: input.password,
  });

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

export async function createCompanyRequest(input: {
  name: string;
  description: string;
  logoUrl?: string;
  refreshToken: string;
}): Promise<AuthSession> {
  const { data, error } = await getApi().auth.companies.post(input);

  if (error) {
    throw toAuthRequestError(error);
  }

  return readSession(data);
}

export async function updateProfileRequest(input: {
  name: string;
  phone: string;
}): Promise<AuthProfile> {
  const { data, error } = await getApi().auth.me.patch(input);

  if (error) {
    throw toAuthRequestError(error);
  }

  return readProfile(data);
}

export async function clearAvatarRequest(): Promise<AuthProfile> {
  const { data, error } = await getApi().auth.me.avatar.delete();

  if (error) {
    throw toAuthRequestError(error);
  }

  return readProfile(data);
}

function readCompany(data: unknown): CompanyIdentity {
  if (!isCompany(data)) {
    throw new AuthRequestError(
      'INVALID_RESPONSE',
      'A API devolveu uma empresa incompleta.',
    );
  }

  return data;
}

export async function createOwnedCompanyRequest(input: {
  name: string;
  description?: string;
}): Promise<CompanyIdentity> {
  const { data, error } = await getApi().companies.post({
    name: input.name,
    description: input.description,
  });

  if (error) {
    throw toAuthRequestError(error);
  }

  return readCompany(data);
}

export async function updateOwnedCompanyRequest(input: {
  tenantId: string;
  name: string;
  description?: string;
}): Promise<CompanyIdentity> {
  const { data, error } = await getApi()
    .companies({ tenantId: input.tenantId })
    .patch({
      name: input.name,
      description: input.description,
    });

  if (error) {
    throw toAuthRequestError(error);
  }

  return readCompany(data);
}

export async function clearLogoRequest(
  tenantId: string,
): Promise<CompanyIdentity> {
  const { data, error } = await getApi()
    .companies({ tenantId })
    .logo.delete();

  if (error) {
    throw toAuthRequestError(error);
  }

  return readCompany(data);
}

export async function switchCompanyRequest(input: {
  tenantId: string;
  refreshToken: string;
}): Promise<AuthSession> {
  const { data, error } = await getApi().auth.tenant.post(input);

  if (error) {
    throw toAuthRequestError(error);
  }

  return readSession(data);
}
