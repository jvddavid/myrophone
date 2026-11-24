import { describe, expect, it } from 'vitest';
import { showCompanySettings } from './company-settings-access';

describe('showCompanySettings', () => {
  it('shows the settings icon when the account owns a company', () => {
    expect(showCompanySettings({ role: 'OWNER', ownsCompany: true })).toBe(
      true,
    );
    expect(showCompanySettings({ role: 'USER', ownsCompany: true })).toBe(
      true,
    );
  });

  it('hides the settings icon for members who do not own a company', () => {
    expect(showCompanySettings({ role: 'ADMIN', ownsCompany: false })).toBe(
      false,
    );
    expect(showCompanySettings({ role: 'USER', ownsCompany: false })).toBe(
      false,
    );
    expect(showCompanySettings({ role: null, ownsCompany: false })).toBe(
      false,
    );
  });
});
