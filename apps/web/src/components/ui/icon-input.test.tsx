import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { IconInput } from './icon-input';

describe('IconInput', () => {
  it('keeps the visible label as the accessible name', () => {
    const html = renderToStaticMarkup(
      <>
        <label htmlFor="profileName">Nome</label>
        <IconInput icon="person" id="profileName" value="Ana" />
      </>,
    );

    expect(html).toContain('for="profileName"');
    expect(html).toContain('>Nome<');
    expect(html).toContain('id="profileName"');
    expect(html).toContain('aria-hidden="true"');
    expect(html).not.toContain('aria-label');
    expect(html).not.toContain('placeholder=');
  });

  it('keeps a password field concealed', () => {
    const html = renderToStaticMarkup(
      <IconInput icon="password" id="password" type="password" value="secret" />,
    );

    expect(html).toContain('type="password"');
    expect(html).not.toContain('type="text"');
  });
});
