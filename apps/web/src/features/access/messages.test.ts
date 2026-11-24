import { describe, expect, it } from 'vitest';
import { badgeVariants } from '@/components/ui/badge-variants';
import { accessErrorMessage, roleBadgeVariant, roleLabel } from './messages';

describe('roleLabel', () => {
  it('names the company roles in Portuguese', () => {
    expect(roleLabel('OWNER')).toBe('Proprietário');
    expect(roleLabel('ADMIN')).toBe('Administrador');
    expect(roleLabel('USER')).toBe('Usuário');
  });

  it('returns an unknown role unchanged', () => {
    expect(roleLabel('GUEST')).toBe('GUEST');
  });
});

describe('roleBadgeVariant', () => {
  it('uses different variants for owner and user', () => {
    const owner = roleBadgeVariant('OWNER');
    const user = roleBadgeVariant('USER');

    expect(owner).toBe('owner');
    expect(user).toBe('member');
    expect(owner).not.toBe(user);
    expect(badgeVariants({ variant: owner })).not.toBe(
      badgeVariants({ variant: user }),
    );
    expect(badgeVariants({ variant: owner })).toContain('bg-primary');
    expect(badgeVariants({ variant: user })).toContain('bg-secondary');
    expect(badgeVariants({ variant: user })).not.toContain('bg-primary');
  });

  it('keeps the same variant for the same role', () => {
    expect(roleBadgeVariant('ADMIN')).toBe('outline');
    expect(roleBadgeVariant('ADMIN')).toBe(roleBadgeVariant('ADMIN'));
    expect(roleBadgeVariant('GUEST')).toBe('outline');
  });
});

describe('accessErrorMessage', () => {
  it('maps each access error to the screen copy', () => {
    expect(accessErrorMessage('USER_NOT_REGISTERED')).toBe(
      'Não há conta com este e-mail. Crie o acesso em vez de convidar.',
    );
    expect(accessErrorMessage('ALREADY_IN_COMPANY')).toBe(
      'Esta pessoa já tem acesso a esta empresa.',
    );
    expect(accessErrorMessage('EMAIL_IN_USE')).toBe(
      'Este e-mail já tem conta. Convide a pessoa em vez de criar outro acesso.',
    );
    expect(accessErrorMessage('NOT_COMPANY_OWNER')).toBe(
      'Só o proprietário desta empresa pode gerenciar acessos.',
    );
    expect(accessErrorMessage('COMPANY_NOT_OWNED')).toBe(
      'Você só pode incluir uma empresa da qual é proprietário.',
    );
    expect(accessErrorMessage('TEAM_NOT_IN_COMPANY')).toBe(
      'O departamento não pertence a esta empresa.',
    );
    expect(accessErrorMessage('TEAM_NOT_FOUND')).toBe(
      'Este departamento não existe nesta empresa.',
    );
    expect(accessErrorMessage('TEAM_SLUG_IN_USE')).toBe(
      'Já existe um departamento com este nome.',
    );
    expect(accessErrorMessage('LAST_OWNER')).toBe(
      'Você é o último proprietário desta empresa e não pode se remover.',
    );
    expect(accessErrorMessage('LAST_TEAM_LEADER')).toBe(
      'Esta pessoa é a última líder do departamento atual. O departamento precisa de outro líder antes da mudança.',
    );
    expect(accessErrorMessage('MEMBERSHIP_NOT_FOUND')).toBe(
      'Esta pessoa não pertence a esta empresa.',
    );
    expect(accessErrorMessage('USER_DISABLED')).toBe(
      'Esta conta está desativada.',
    );
    expect(accessErrorMessage('DUPLICATE_COMPANY')).toBe(
      'Cada empresa só pode aparecer uma vez.',
    );
    expect(accessErrorMessage('NO_ACTIVE_TENANT')).toBe(
      'Escolha uma empresa antes de gerenciar acessos.',
    );
    expect(accessErrorMessage('UNAUTHORIZED')).toBe(
      'Sua sessão expirou. Entre de novo.',
    );
    expect(accessErrorMessage('VALIDATION_ERROR')).toBe(
      'Revise os campos e tente de novo.',
    );
  });

  it('uses a generic sentence for an unknown code', () => {
    expect(accessErrorMessage('SOMETHING_ELSE')).toBe(
      'Não foi possível concluir. Tente de novo.',
    );
  });
});
