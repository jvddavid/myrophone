import { describe, expect, it } from 'vitest';
import { needsEmailActivation } from './email-activation';

const user = { emailVerifiedAt: null };

describe('needsEmailActivation', () => {
  it('holds the account on the activation page only when delivery is required', () => {
    expect(
      needsEmailActivation({
        emailActivationRequired: true,
        user,
      }),
    ).toBe(true);
    expect(
      needsEmailActivation({
        emailActivationRequired: false,
        user,
      }),
    ).toBe(false);
    expect(
      needsEmailActivation({
        emailActivationRequired: true,
        user: { emailVerifiedAt: '2026-11-24T12:00:00.000Z' },
      }),
    ).toBe(false);
  });
});
