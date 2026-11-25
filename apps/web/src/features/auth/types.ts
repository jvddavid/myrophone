import type { CompanyIdentity } from './company-profile';

export interface AuthProfile {
  sessionId: string;
  membershipId: string | null;
  user: {
    id: string;
    email: string;
    name: string | null;
    phone: string | null;
    avatarUrl: string | null;
    emailVerifiedAt: string | Date | null;
    isActive: boolean;
  };
  emailActivationRequired: boolean;
  tenant: CompanyIdentity | null;
  companies: CompanyIdentity[];
  ownsCompany: boolean;
  role: string | null;
  permissions: string[];
  teams: Array<{
    id: string;
    slug: string;
    name: string;
    membershipRole: string;
    permissionKeys: string[];
  }>;
  teamPermissions: string[];
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  accessTokenTtl: string;
  refreshTokenExpiresAt: string;
}

export interface AuthSession extends AuthProfile {
  tokens: AuthTokens;
}

const messages: Record<string, string> = {
  INVALID_CREDENTIALS: 'E-mail ou senha incorretos.',
  USER_DISABLED: 'Esta conta está desativada.',
  TENANT_NOT_FOUND: 'Empresa não encontrada.',
  NO_ACTIVE_TENANT: 'Esta conta não está vinculada a uma empresa ativa.',
  MEMBERSHIP_NOT_ACTIVE: 'Seu acesso a esta empresa não está ativo.',
  EMAIL_IN_USE: 'Este e-mail já está em uso.',
  TENANT_SLUG_IN_USE: 'Já existe uma empresa com esse identificador.',
  INVALID_PASSWORD: 'A senha precisa ter pelo menos 8 caracteres.',
  VALIDATION_ERROR: 'Revise os campos e tente de novo.',
  NOT_COMPANY_OWNER: 'Só o dono pode gerenciar esta empresa.',
  UNAUTHORIZED: 'Sua sessão expirou. Entre de novo.',
  COMPANY_CREATE_UNAVAILABLE: 'Esta conta já tem uma empresa.',
  INVALID_REFRESH_TOKEN: 'Sua sessão expirou. Entre de novo.',
  EMAIL_NOT_VERIFIED: 'Confirme seu e-mail para continuar.',
  INVALID_EMAIL_TOKEN: 'Este link de ativação não é válido.',
  EMAIL_TOKEN_USED: 'Este link já foi usado. Peça outro e-mail.',
  EMAIL_TOKEN_EXPIRED: 'Este link expirou. Peça outro e-mail.',
  INVALID_EMAIL_CODE: 'Código inválido.',
  EMAIL_CODE_USED: 'Este código já foi usado. Peça outro e-mail.',
  EMAIL_CODE_EXPIRED: 'Este código expirou. Peça outro e-mail.',
  EMAIL_RESEND_LIMIT: 'Espere um minuto antes de pedir outro e-mail.',
  EMAIL_DELIVERY_FAILED: 'Não foi possível enviar o e-mail de ativação.',
  EMAIL_DELIVERY_DISABLED: 'A ativação por e-mail não está ligada.',
};

export function authErrorMessage(code: string, fallback: string): string {
  return messages[code] ?? fallback;
}
