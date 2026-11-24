import { brazilPhoneDigits, parseBrazilPhone } from '@myrophone/shared';
import { brazilPhoneInvalidMessage } from '@/lib/brazil-phone';

export interface OwnedCompanyOption {
  id: string;
  name: string;
  teams: Array<{ id: string; slug: string; name: string }>;
}

export interface CreateAccessSelection {
  tenantIds: string[];
  teamByTenant: Record<string, string>;
}

export function preferredTeamId(
  teams: OwnedCompanyOption['teams'],
): string | null {
  return teams.find((team) => team.slug === 'geral')?.id ?? teams[0]?.id ?? null;
}

export function initialCreateAccessSelection(
  companies: OwnedCompanyOption[],
  activeTenantId: string,
): CreateAccessSelection {
  const active = companies.find((company) => company.id === activeTenantId);
  const teamId = active ? preferredTeamId(active.teams) : null;

  if (!active || !teamId) {
    return { tenantIds: [], teamByTenant: {} };
  }

  return { tenantIds: [active.id], teamByTenant: { [active.id]: teamId } };
}

export function toggleOwnedCompany(
  selection: CreateAccessSelection,
  company: OwnedCompanyOption,
  checked: boolean,
): CreateAccessSelection {
  if (!checked) {
    const teamByTenant = { ...selection.teamByTenant };
    delete teamByTenant[company.id];
    return {
      tenantIds: selection.tenantIds.filter((id) => id !== company.id),
      teamByTenant,
    };
  }

  if (selection.tenantIds.includes(company.id)) {
    return selection;
  }

  const teamId = preferredTeamId(company.teams);
  return {
    tenantIds: [...selection.tenantIds, company.id],
    teamByTenant: teamId
      ? { ...selection.teamByTenant, [company.id]: teamId }
      : { ...selection.teamByTenant },
  };
}

export function selectDepartment(
  selection: CreateAccessSelection,
  tenantId: string,
  teamId: string,
): CreateAccessSelection {
  return {
    tenantIds: selection.tenantIds,
    teamByTenant: { ...selection.teamByTenant, [tenantId]: teamId },
  };
}

export function createAccessIdentityError(input: {
  name: string;
  phone: string;
  password: string;
}): string | null {
  if (input.name.trim().length < 2) {
    return 'O nome precisa ter pelo menos 2 caracteres.';
  }

  if (!parseBrazilPhone(input.phone)) {
    return brazilPhoneInvalidMessage;
  }

  if (input.password.length < 8) {
    return 'A senha precisa ter pelo menos 8 caracteres.';
  }

  return null;
}

export function createAccessCompaniesError(input: {
  selection: CreateAccessSelection;
  companies: OwnedCompanyOption[];
}): string | null {
  if (input.selection.tenantIds.length === 0) {
    return 'Escolha ao menos uma empresa.';
  }

  const companyById = new Map(input.companies.map((company) => [company.id, company]));

  for (const tenantId of input.selection.tenantIds) {
    if (!input.selection.teamByTenant[tenantId]) {
      const company = companyById.get(tenantId);
      return `Escolha o departamento de ${company?.name ?? 'empresa'}.`;
    }
  }

  return null;
}

export function createAccessFormError(input: {
  name: string;
  phone: string;
  password: string;
  selection: CreateAccessSelection;
  companies: OwnedCompanyOption[];
}): string | null {
  return createAccessIdentityError(input) ?? createAccessCompaniesError(input);
}

export function toCreateAccessBody(input: {
  name: string;
  phone: string;
  email: string;
  password: string;
  selection: CreateAccessSelection;
}): {
  name: string;
  phone: string;
  email: string;
  password: string;
  companies: Array<{ tenantId: string; teamId: string }>;
} {
  return {
    name: input.name.trim(),
    phone: brazilPhoneDigits(input.phone),
    email: input.email.trim(),
    password: input.password,
    companies: input.selection.tenantIds.map((tenantId) => ({
      tenantId,
      teamId: input.selection.teamByTenant[tenantId] ?? '',
    })),
  };
}
