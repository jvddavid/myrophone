import { describe, expect, it } from 'vitest';
import { AppError } from '../../core/errors/app-error';
import { normalizePhone } from './phone';

describe('normalizePhone', () => {
  it('stores 11 digits from a masked mobile number', () => {
    expect(normalizePhone(' (11) 98765-4321 ')).toBe('11987654321');
  });

  it('stores 10 digits from a landline', () => {
    expect(normalizePhone('(11) 3456-7890')).toBe('1134567890');
  });

  it('rejects a phone that is not 10 or 11 digits', () => {
    expect(() => normalizePhone('1234567')).toThrow(AppError);
    expect(() => normalizePhone('00000000')).toThrow(AppError);
  });

  it('rejects a phone with letters', () => {
    expect(() => normalizePhone('telefone!!')).toThrow(AppError);

    let error: unknown;
    try {
      normalizePhone('telefone!!');
    } catch (caught) {
      error = caught;
    }

    expect(error).toBeInstanceOf(AppError);
    expect((error as AppError).code).toBe('VALIDATION_ERROR');
    expect((error as AppError).statusCode).toBe(400);
  });
});
