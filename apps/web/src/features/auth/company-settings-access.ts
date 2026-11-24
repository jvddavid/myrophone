export function showCompanySettings(input: {
  role: string | null;
  ownsCompany: boolean;
}): boolean {
  return input.ownsCompany;
}
