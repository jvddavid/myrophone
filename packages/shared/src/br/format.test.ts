import { describe, expect, it } from 'bun:test';
import {
  formatBrazilPercent,
  formatBrazilPhone,
  formatBrlFromCents,
  nextMaskDigits,
  parseBrazilPercent,
  parseBrazilPhone,
  parseBrlToCents,
} from './format';

describe('formatBrazilPhone', () => {
  it('masks a mobile number and a landline', () => {
    expect(formatBrazilPhone('11987654321')).toBe('(11) 98765-4321');
    expect(formatBrazilPhone('(11) 98765-4321')).toBe('(11) 98765-4321');
    expect(formatBrazilPhone('1134567890')).toBe('(11) 3456-7890');
  });

  it('shows the legacy default as digits', () => {
    expect(formatBrazilPhone('00000000')).toBe('00000000');
    expect(formatBrazilPhone('')).toBe('');
  });

  it('masks a number while it is still being typed', () => {
    expect(formatBrazilPhone('11')).toBe('(11)');
    expect(formatBrazilPhone('1198765')).toBe('(11) 9876-5');
  });
});

describe('parseBrazilPhone', () => {
  it('keeps 10 or 11 digits and drops separators', () => {
    expect(parseBrazilPhone(' (11) 98765-4321 ')).toBe('11987654321');
    expect(parseBrazilPhone('(11) 3456-7890')).toBe('1134567890');
  });

  it('rejects empty, legacy, short, and letter values', () => {
    expect(parseBrazilPhone('')).toBeNull();
    expect(parseBrazilPhone('00000000')).toBeNull();
    expect(parseBrazilPhone('1234567')).toBeNull();
    expect(parseBrazilPhone('telefone!!')).toBeNull();
  });
});

describe('reais', () => {
  it('formats cents with the Brazilian currency pattern', () => {
    expect(formatBrlFromCents(0)).toBe('R$ 0,00');
    expect(formatBrlFromCents(1000)).toBe('R$ 10,00');
    expect(formatBrlFromCents(1550)).toBe('R$ 15,50');
    expect(formatBrlFromCents(3000)).toBe('R$ 30,00');
    expect(formatBrlFromCents(123456)).toBe('R$ 1.234,56');
  });

  it('reads a formatted amount back into cents', () => {
    expect(parseBrlToCents('R$ 0,00')).toBe(0);
    expect(parseBrlToCents('R$ 10,00')).toBe(1000);
    expect(parseBrlToCents('R$ 15,50')).toBe(1550);
    expect(parseBrlToCents('R$ 30,00')).toBe(3000);
    expect(parseBrlToCents('R$ 1.234,56')).toBe(123456);
    expect(parseBrlToCents('')).toBe(0);
  });
});

describe('percent', () => {
  it('formats a percent with a decimal comma', () => {
    expect(formatBrazilPercent(0)).toBe('0,00%');
    expect(formatBrazilPercent(10.5)).toBe('10,50%');
    expect(formatBrazilPercent(100)).toBe('100,00%');
    expect(formatBrazilPercent(150)).toBe('100,00%');
  });

  it('parses typed digits as percent points and caps at 100', () => {
    expect(parseBrazilPercent('0,00%')).toBe(0);
    expect(parseBrazilPercent('10,50%')).toBe(10.5);
    expect(parseBrazilPercent('1050')).toBe(10.5);
    expect(parseBrazilPercent('10050')).toBe(100);
    expect(parseBrazilPercent('')).toBe(0);
  });
});

describe('nextMaskDigits', () => {
  it('drops the last digit when the deleted character is a symbol', () => {
    expect(nextMaskDigits('10,50%', '10,50')).toBe('105');
    expect(nextMaskDigits('R$ 10,00', 'R$ 10,0')).toBe('100');
  });
});
