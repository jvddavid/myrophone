import { describe, expect, it } from 'vitest';
import {
  createAccessFormError,
  initialCreateAccessSelection,
  selectDepartment,
  toCreateAccessBody,
  toggleOwnedCompany,
  type OwnedCompanyOption,
} from './create-access-form';

const active: OwnedCompanyOption = {
  id: 'tenant-active',
  name: 'Ativa',
  teams: [
    { id: 'team-geral', slug: 'geral', name: 'Geral' },
    { id: 'team-filial', slug: 'filial', name: 'Filial' },
  ],
};

const other: OwnedCompanyOption = {
  id: 'tenant-other',
  name: 'Filial Norte',
  teams: [{ id: 'team-other-filial', slug: 'filial', name: 'Filial' }],
};

const companies = [active, other];

describe('initialCreateAccessSelection', () => {
  it('checks only the active company and picks the geral department', () => {
    expect(initialCreateAccessSelection(companies, active.id)).toEqual({
      tenantIds: [active.id],
      teamByTenant: { [active.id]: 'team-geral' },
    });
  });

  it('picks the first team when geral is missing', () => {
    const withoutGeral: OwnedCompanyOption = {
      id: active.id,
      name: active.name,
      teams: [
        { id: 'team-first', slug: 'loja', name: 'Loja' },
        { id: 'team-second', slug: 'filial', name: 'Filial' },
      ],
    };

    expect(initialCreateAccessSelection([withoutGeral], active.id)).toEqual({
      tenantIds: [active.id],
      teamByTenant: { [active.id]: 'team-first' },
    });
  });

  it('stays empty when the active company is not in the owned list', () => {
    expect(initialCreateAccessSelection([other], 'missing')).toEqual({
      tenantIds: [],
      teamByTenant: {},
    });
  });
});

describe('toggleOwnedCompany', () => {
  it('removes the company and its department', () => {
    const selection = initialCreateAccessSelection(companies, active.id);

    expect(toggleOwnedCompany(selection, active, false)).toEqual({
      tenantIds: [],
      teamByTenant: {},
    });
  });

  it('adds another owned company with its filial department', () => {
    const selection = initialCreateAccessSelection(companies, active.id);

    expect(toggleOwnedCompany(selection, other, true)).toEqual({
      tenantIds: [active.id, other.id],
      teamByTenant: {
        [active.id]: 'team-geral',
        [other.id]: 'team-other-filial',
      },
    });
  });
});

describe('selectDepartment', () => {
  it('replaces the department of a checked company', () => {
    const selection = initialCreateAccessSelection(companies, active.id);

    expect(
      selectDepartment(selection, active.id, 'team-filial').teamByTenant[active.id],
    ).toBe('team-filial');
  });
});

describe('createAccessFormError', () => {
  const valid = {
    name: 'Pessoa',
    password: 'senha-forte',
    selection: initialCreateAccessSelection(companies, active.id),
    companies,
  };

  it('rejects a one-character name before the other checks', () => {
    expect(
      createAccessFormError({
        ...valid,
        name: 'A',
        password: 'curta',
        selection: { tenantIds: [], teamByTenant: {} },
      }),
    ).toBe('O nome precisa ter pelo menos 2 caracteres.');
  });

  it('rejects a password shorter than 8 characters', () => {
    expect(createAccessFormError({ ...valid, password: '1234567' })).toBe(
      'A senha precisa ter pelo menos 8 caracteres.',
    );
  });

  it('requires at least one company', () => {
    expect(
      createAccessFormError({
        ...valid,
        selection: { tenantIds: [], teamByTenant: {} },
      }),
    ).toBe('Escolha ao menos uma empresa.');
  });

  it('requires a department for each checked company', () => {
    expect(
      createAccessFormError({
        ...valid,
        selection: { tenantIds: [other.id], teamByTenant: {} },
      }),
    ).toBe('Escolha o departamento de Filial Norte.');
  });

  it('accepts a complete form', () => {
    expect(createAccessFormError(valid)).toBeNull();
  });
});

describe('toCreateAccessBody', () => {
  it('trims the text fields and keeps the company order', () => {
    const selection = toggleOwnedCompany(
      initialCreateAccessSelection(companies, active.id),
      other,
      true,
    );

    expect(
      toCreateAccessBody({
        name: '  Nova Pessoa  ',
        phone: '  (11) 98888-7777  ',
        email: '  Pessoa@Exemplo.com  ',
        password: 'senha-forte',
        selection,
      }),
    ).toEqual({
      name: 'Nova Pessoa',
      phone: '(11) 98888-7777',
      email: 'Pessoa@Exemplo.com',
      password: 'senha-forte',
      companies: [
        { tenantId: active.id, teamId: 'team-geral' },
        { tenantId: other.id, teamId: 'team-other-filial' },
      ],
    });
  });
});
