import { describe, expect, it } from 'vitest';
import { companyDraft, companyInitials } from './company-profile';

describe('companyDraft', () => {
  it('trims the company name, description and logo', () => {
    expect(
      companyDraft({
        name: '  Acme  ',
        description: '  Celulares. ',
        logoUrl: '  https://cdn.example/logo.png  ',
      }),
    ).toEqual({
      name: 'Acme',
      description: 'Celulares.',
      logoUrl: 'https://cdn.example/logo.png',
    });
  });
});

describe('companyInitials', () => {
  it('uses the first letter of the first two words', () => {
    expect(companyInitials('Acme Celulares')).toBe('AC');
    expect(companyInitials(' loja ')).toBe('L');
  });
});
