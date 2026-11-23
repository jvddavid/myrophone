import { describe, expect, it } from 'vitest';
import { showCreateCompany } from './show-create-company';

describe('showCreateCompany', () => {
  it('shows the form when the session has no company', () => {
    expect(showCreateCompany(null)).toBe(true);
  });

  it('hides the form when a company is selected', () => {
    expect(
      showCreateCompany({ id: 'tenant-1', slug: 'acme', name: 'Acme' }),
    ).toBe(false);
  });
});
