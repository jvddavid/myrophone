import { formatBrazilPhone } from '@myrophone/shared';
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { readPhoneDigits } from './phone-input-model';
import { PhoneInput } from './phone-input';

function typePhone(digits: string): string {
  let phone = '';

  for (const digit of digits) {
    const shown = formatBrazilPhone(phone);
    phone = readPhoneDigits(phone, shown + digit);
  }

  return phone;
}

describe('PhoneInput', () => {
  it('types a mobile number into the DDD mask', () => {
    expect(typePhone('11987654321')).toBe('11987654321');
    expect(formatBrazilPhone(typePhone('11987654321'))).toBe('(11) 98765-4321');
    expect(formatBrazilPhone(typePhone('1134567890'))).toBe('(11) 3456-7890');
  });

  it('ignores a twelfth digit and leaves the legacy default unmasked', () => {
    expect(readPhoneDigits('11987654321', '(11) 98765-43219')).toBe('11987654321');
    expect(formatBrazilPhone('00000000')).toBe('00000000');
  });

  it('renders the accessible phone label', () => {
    const html = renderToStaticMarkup(
      <PhoneInput id="profilePhone" onChange={() => undefined} value="11987654321" />,
    );

    expect(html).toContain('for="profilePhone"');
    expect(html).toContain('Telefone');
    expect(html).toContain('(11) 98765-4321');
  });
});
