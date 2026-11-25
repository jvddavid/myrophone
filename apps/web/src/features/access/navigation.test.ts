import { describe, expect, it } from 'vitest';
import {
  canRemoveMember,
  canViewPanel,
  sidebarDestinations,
} from './navigation';

describe('sidebarDestinations', () => {
  it('shows each screen only when the effective permission is present', () => {
    expect(
      sidebarDestinations({
        permissions: ['users.read', 'teams.read'],
        teamPermissions: ['dashboard.view'],
      }),
    ).toEqual(['panel', 'access', 'departments']);

    expect(
      sidebarDestinations({
        permissions: ['users.read'],
        teamPermissions: [],
      }),
    ).toEqual(['access']);

    expect(
      sidebarDestinations({
        permissions: [],
        teamPermissions: [],
      }),
    ).toEqual([]);
  });

  it('does not treat the owner role as a shortcut', () => {
    expect(
      sidebarDestinations({
        permissions: [],
        teamPermissions: [],
      }),
    ).toEqual([]);
    expect(canViewPanel([])).toBe(false);
    expect(canViewPanel(['dashboard.view'])).toBe(true);
  });
});

describe('canRemoveMember', () => {
  it('keeps owner removal behind the owner permission', () => {
    expect(canRemoveMember('OWNER', ['users.manage'])).toBe(false);
    expect(
      canRemoveMember('OWNER', ['users.manage', 'permissions.manage']),
    ).toBe(true);
    expect(canRemoveMember('ADMIN', ['users.manage'])).toBe(true);
    expect(canRemoveMember('USER', [])).toBe(false);
  });
});
