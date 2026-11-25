import { describe, expect, it } from 'vitest';
import {
  groupCatalog,
  samePermissionKeys,
  togglePermissionKey,
} from './permission-groups';

describe('groupCatalog', () => {
  it('orders the company catalog and keeps unknown groups at the end', () => {
    const grouped = groupCatalog([
      {
        key: 'dashboard.view',
        description: 'Ver o painel',
        group: 'Telas',
        scope: 'team',
      },
      {
        key: 'users.read',
        description: 'Listar pessoas',
        group: 'Pessoas',
        scope: 'tenant',
      },
      {
        key: 'custom.flag',
        description: 'Algo novo',
        group: 'Outros',
        scope: 'tenant',
      },
    ]);

    expect(grouped.map((section) => section.group)).toEqual([
      'Pessoas',
      'Telas',
      'Outros',
    ]);
    expect(grouped[0]?.entries.map((entry) => entry.key)).toEqual([
      'users.read',
    ]);
  });
});

describe('togglePermissionKey', () => {
  it('adds and removes one key without changing the others', () => {
    expect(togglePermissionKey(['users.read'], 'teams.read', true)).toEqual([
      'teams.read',
      'users.read',
    ]);
    expect(
      togglePermissionKey(['teams.read', 'users.read'], 'users.read', false),
    ).toEqual(['teams.read']);
    expect(samePermissionKeys(['b', 'a'], ['a', 'b'])).toBe(true);
    expect(samePermissionKeys(['a'], ['a', 'b'])).toBe(false);
  });
});
