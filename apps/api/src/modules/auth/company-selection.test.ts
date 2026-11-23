import { describe, expect, it } from 'vitest';
import { chooseActiveTenantId, withSlugSuffix } from './company-selection';

const older = new Date('2020-01-01T00:00:00.000Z');
const newer = new Date('2024-01-01T00:00:00.000Z');

describe('chooseActiveTenantId', () => {
  it('returns null when the account has no active company', () => {
    expect(
      chooseActiveTenantId(
        [{ tenantId: 'a', createdAt: older, status: 'SUSPENDED' }],
        'a',
      ),
    ).toBeNull();
  });

  it('returns the oldest active company when none was saved', () => {
    expect(
      chooseActiveTenantId(
        [
          { tenantId: 'new', createdAt: newer, status: 'ACTIVE' },
          { tenantId: 'old', createdAt: older, status: 'ACTIVE' },
        ],
        null,
      ),
    ).toBe('old');
  });

  it('returns the saved company when that membership is still active', () => {
    expect(
      chooseActiveTenantId(
        [
          { tenantId: 'old', createdAt: older, status: 'ACTIVE' },
          { tenantId: 'saved', createdAt: newer, status: 'ACTIVE' },
        ],
        'saved',
      ),
    ).toBe('saved');
  });

  it('falls back to the oldest active company when the saved one is inactive', () => {
    expect(
      chooseActiveTenantId(
        [
          { tenantId: 'saved', createdAt: newer, status: 'SUSPENDED' },
          { tenantId: 'old', createdAt: older, status: 'ACTIVE' },
        ],
        'saved',
      ),
    ).toBe('old');
  });
});

describe('withSlugSuffix', () => {
  it('keeps the first slug and suffixes the later attempts', () => {
    expect(withSlugSuffix('acme', 1)).toBe('acme');
    expect(withSlugSuffix('acme', 2)).toBe('acme-2');
  });
});
