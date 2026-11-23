import { describe, expect, it } from 'vitest';
import { registerPasswordError } from './register-form';

describe('registerPasswordError', () => {
  it('asks for both passwords to match', () => {
    expect(registerPasswordError('senha-forte', 'outra-senha')).toBe(
      'As senhas não coincidem.',
    );
  });

  it('accepts two equal passwords', () => {
    expect(registerPasswordError('senha-forte', 'senha-forte')).toBeNull();
  });
});
