import { describe, expect, it } from 'vitest';
import { AppError } from '../../core/errors/app-error';
import { isUniqueViolation, normalizeName } from './input-rules';

describe('normalizeName', () => {
  it('trims a valid name', () => {
    expect(normalizeName('  Ana ', 'Name')).toBe('Ana');
  });

  it('rejects a name shorter than 2 characters after trim', () => {
    expect(() => normalizeName('  a ', 'Name')).toThrow(AppError);
    expect(() => normalizeName('   ', 'Name')).toThrow(AppError);
  });
});

describe('isUniqueViolation', () => {
  it('recognises the Prisma unique constraint code', () => {
    expect(isUniqueViolation({ code: 'P2002' })).toBe(true);
  });

  it('ignores other errors', () => {
    expect(isUniqueViolation({ code: 'P2025' })).toBe(false);
    expect(isUniqueViolation(new Error('boom'))).toBe(false);
    expect(isUniqueViolation(null)).toBe(false);
  });
});
