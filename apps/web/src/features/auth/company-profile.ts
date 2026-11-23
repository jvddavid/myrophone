export interface CompanyIdentity {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  logoUrl: string | null;
}

export interface CompanyDraft {
  name: string;
  description: string;
  logoUrl: string;
}

export function companyDraft(input: CompanyDraft): CompanyDraft {
  return {
    name: input.name.trim(),
    description: input.description.trim(),
    logoUrl: input.logoUrl.trim(),
  };
}

export function companyInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter((word) => word.length > 0);
  const initials = words
    .slice(0, 2)
    .map((word) => word[0] ?? '')
    .join('')
    .toLocaleUpperCase('pt-BR');

  return initials || 'E';
}
