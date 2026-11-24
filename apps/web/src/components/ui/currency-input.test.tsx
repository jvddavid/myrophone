import { formatBrlFromCents } from '@myrophone/shared';
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { readCurrencyCents } from './currency-input-model';
import { CurrencyInput } from './currency-input';

function typeCents(digits: string): number {
  let cents = 0;

  for (const digit of digits) {
    const shown = formatBrlFromCents(cents);
    cents = readCurrencyCents(cents, shown + digit);
  }

  return cents;
}

describe('CurrencyInput', () => {
  it('types digits as cents', () => {
    expect(typeCents('1000')).toBe(1000);
    expect(formatBrlFromCents(typeCents('1000'))).toBe('R$ 10,00');
    expect(typeCents('1550')).toBe(1550);
    expect(formatBrlFromCents(typeCents('1550'))).toBe('R$ 15,50');
    expect(typeCents('3000')).toBe(3000);
    expect(formatBrlFromCents(typeCents('3000'))).toBe('R$ 30,00');
    expect(typeCents('123456')).toBe(123456);
    expect(formatBrlFromCents(typeCents('123456'))).toBe('R$ 1.234,56');
  });

  it('removes the last cent when the last character is deleted', () => {
    const shown = formatBrlFromCents(1000);

    expect(readCurrencyCents(1000, shown.slice(0, -1))).toBe(100);
    expect(formatBrlFromCents(0)).toBe('R$ 0,00');
  });

  it('renders the reais amount with an accessible label', () => {
    const html = renderToStaticMarkup(
      <CurrencyInput
        disabled
        id="amount"
        label="Valor"
        onChange={() => undefined}
        value={1000}
      />,
    );

    expect(html).toContain('for="amount"');
    expect(html).toContain('Valor');
    expect(html).toContain('R$ 10,00');
    expect(html).toContain('disabled');
  });
});
