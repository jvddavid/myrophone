import { describe, expect, it } from 'vitest';
import { AppError } from '../../core/errors/app-error';
import {
  isUniqueViolation,
  normalizeDescription,
  normalizeLogoUrl,
  normalizeName,
} from './input-rules';

describe('normalizeName', () => {
  it('trims a valid name', () => {
    expect(normalizeName('  Ana ', 'Name')).toBe('Ana');
  });

  it('rejects a name shorter than 2 characters after trim', () => {
    expect(() => normalizeName('  a ', 'Name')).toThrow(AppError);
    expect(() => normalizeName('   ', 'Name')).toThrow(AppError);
  });
});

describe('normalizeDescription', () => {
  it('trims a company description', () => {
    expect(normalizeDescription('  Assistência de celulares. ')).toBe(
      'Assistência de celulares.',
    );
  });

  it('rejects a description outside 2 to 280 characters', () => {
    expect(() => normalizeDescription(' a ')).toThrow(AppError);
    expect(() => normalizeDescription('a'.repeat(281))).toThrow(AppError);
  });
});

describe('normalizeLogoUrl', () => {
  it('keeps an http or https logo and treats a blank value as absent', () => {
    expect(normalizeLogoUrl(' https://cdn.example/logo.png ')).toBe(
      'https://cdn.example/logo.png',
    );
    expect(normalizeLogoUrl('   ')).toBeNull();
    expect(normalizeLogoUrl(undefined)).toBeNull();
  });

  it('rejects a logo that is not an http address', () => {
    expect(() => normalizeLogoUrl('nota-url')).toThrow(AppError);
    expect(() => normalizeLogoUrl('ftp://cdn.example/logo.png')).toThrow(
      AppError,
    );
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
