import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const dir = dirname(fileURLToPath(import.meta.url));

describe('access navigation', () => {
  it('adds owner links beside the existing panel item', () => {
    const sidebar = readFileSync(resolve(dir, '../auth/app-sidebar.tsx'), 'utf8');
    const layout = readFileSync(
      resolve(dir, '../auth/authenticated-layout.tsx'),
      'utf8',
    );

    expect(sidebar).toContain('to="/acessos"');
    expect(sidebar).toContain('to="/departamentos"');
    expect(sidebar).toContain("destinations.includes('panel')");
    expect(sidebar).toContain("destinations.includes('access')");
    expect(sidebar).toContain("destinations.includes('departments')");
    expect(layout).toContain('sidebarDestinations');
    expect(layout).not.toContain("auth.role === 'OWNER'");
  });
});
