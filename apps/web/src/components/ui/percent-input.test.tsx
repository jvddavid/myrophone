import { formatBrazilPercent } from '@myrophone/shared';
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { readPercentValue } from './percent-input-model';
import { PercentInput } from './percent-input';

function typePercent(digits: string): number {
  let percent = 0;

  for (const digit of digits) {
    const shown = formatBrazilPercent(percent);
    percent = readPercentValue(percent, shown + digit);
  }

  return percent;
}

describe('PercentInput', () => {
  it('types digits as percent points with two decimals', () => {
    expect(typePercent('1050')).toBe(10.5);
    expect(formatBrazilPercent(typePercent('1050'))).toBe('10,50%');
    expect(typePercent('0')).toBe(0);
    expect(formatBrazilPercent(0)).toBe('0,00%');
  });

  it('caps the value at 100 percent', () => {
    expect(typePercent('10050')).toBe(100);
    expect(formatBrazilPercent(typePercent('10050'))).toBe('100,00%');
  });

  it('removes the last digit when the percent sign is deleted', () => {
    expect(readPercentValue(10.5, '10,50')).toBe(1.05);
    expect(formatBrazilPercent(1.05)).toBe('1,05%');
  });

  it('renders the percent with an accessible label', () => {
    const html = renderToStaticMarkup(
      <PercentInput
        disabled
        id="rate"
        label="Taxa"
        onChange={() => undefined}
        value={10.5}
      />,
    );

    expect(html).toContain('for="rate"');
    expect(html).toContain('Taxa');
    expect(html).toContain('10,50%');
    expect(html).toContain('disabled');
  });
});
