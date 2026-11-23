export interface AuthProfile {
  sessionId: string;
  membershipId: string;
  user: {
    id: string;
    email: string;
    name: string | null;
    isActive: boolean;
  };
  tenant: {
    id: string;
    slug: string;
    name: string;
  };
  role: string;
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
  TENANT_REQUIRED:
    'Informe o identificador da empresa. Esta conta participa de mais de uma.',
  NO_ACTIVE_TENANT: 'Esta conta não está vinculada a uma empresa ativa.',
  MEMBERSHIP_NOT_ACTIVE: 'Seu acesso a esta empresa não está ativo.',
  EMAIL_IN_USE: 'Este e-mail já está em uso.',
  TENANT_SLUG_IN_USE: 'Já existe uma empresa com esse identificador.',
  INVALID_PASSWORD: 'A senha precisa ter pelo menos 8 caracteres.',
  VALIDATION_ERROR: 'Revise os campos e tente de novo.',
  UNAUTHORIZED: 'Sua sessão expirou. Entre de novo.',
};

export function authErrorMessage(code: string, fallback: string): string {
  return messages[code] ?? fallback;
}
