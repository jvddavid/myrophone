import { describe, expect, it } from 'vitest';
import { profileUpdatePayload } from './profile-payload';

describe('profileUpdatePayload', () => {
  it('sends the trimmed name and phone', () => {
    expect(
      profileUpdatePayload({
        name: '  Ana Silva ',
        phone: ' (11) 98888-7777 ',
        email: 'ana@example.com',
      }),
    ).toEqual({
      name: 'Ana Silva',
      phone: '(11) 98888-7777',
    });
  });
});
