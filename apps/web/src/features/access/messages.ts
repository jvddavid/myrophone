const messages: Record<string, string> = {
  USER_NOT_REGISTERED:
    'Não há conta com este e-mail. Crie o acesso em vez de convidar.',
  ALREADY_IN_COMPANY: 'Esta pessoa já tem acesso a esta empresa.',
  EMAIL_IN_USE:
    'Este e-mail já tem conta. Convide a pessoa em vez de criar outro acesso.',
  NOT_COMPANY_OWNER: 'Só o proprietário desta empresa pode gerenciar acessos.',
  COMPANY_NOT_OWNED: 'Você só pode incluir uma empresa da qual é proprietário.',
  TEAM_NOT_IN_COMPANY: 'O departamento não pertence a esta empresa.',
  TEAM_NOT_FOUND: 'Este departamento não existe nesta empresa.',
  TEAM_SLUG_IN_USE: 'Já existe um departamento com este nome.',
  LAST_OWNER:
    'Você é o último proprietário desta empresa e não pode se remover.',
  LAST_TEAM_LEADER:
    'Esta pessoa é a última líder do departamento atual. O departamento precisa de outro líder antes da mudança.',
  MEMBERSHIP_NOT_FOUND: 'Esta pessoa não pertence a esta empresa.',
  USER_DISABLED: 'Esta conta está desativada.',
  DUPLICATE_COMPANY: 'Cada empresa só pode aparecer uma vez.',
  NO_ACTIVE_TENANT: 'Escolha uma empresa antes de gerenciar acessos.',
  UNAUTHORIZED: 'Sua sessão expirou. Entre de novo.',
  VALIDATION_ERROR: 'Revise os campos e tente de novo.',
};

export function roleLabel(role: string): string {
  if (role === 'OWNER') {
    return 'Proprietário';
  }

  if (role === 'ADMIN') {
    return 'Administrador';
  }

  if (role === 'USER') {
    return 'Usuário';
  }

  return role;
}

export function roleBadgeVariant(
  role: string,
): 'owner' | 'member' | 'outline' {
  if (role === 'OWNER') {
    return 'owner';
  }

  if (role === 'USER') {
    return 'member';
  }

  return 'outline';
}

export function accessErrorMessage(code: string): string {
  return messages[code] ?? 'Não foi possível concluir. Tente de novo.';
}
