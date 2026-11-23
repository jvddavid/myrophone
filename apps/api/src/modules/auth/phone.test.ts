import { describe, expect, it } from 'vitest';
import { AppError } from '../../core/errors/app-error';
import { normalizePhone } from './phone';

describe('normalizePhone', () => {
  it('trims a phone made of digits and allowed separators', () => {
    expect(normalizePhone(' (11) 98765-4321 ')).toBe('(11) 98765-4321');
  });

  it('rejects a phone outside 8 to 20 characters', () => {
    expect(() => normalizePhone('1234567')).toThrow(AppError);
  });

  it('rejects a phone with letters', () => {
    try {
      normalizePhone('telefone!!');
    } catch (error) {
      expect(error).toBeInstanceOf(AppError);
      expect((error as AppError).code).toBe('VALIDATION_ERROR');
      expect((error as AppError).statusCode).toBe(400);
    }
  });
});
