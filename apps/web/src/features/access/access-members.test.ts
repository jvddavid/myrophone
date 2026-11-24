import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { memberListQuery } from './api';
import { roleBadgeVariant } from './messages';

const dir = dirname(fileURLToPath(import.meta.url));

describe('access member list', () => {
  it('includes page and q on the list request', () => {
    expect(memberListQuery({ q: 'Ana', page: 2, pageSize: 20 })).toEqual({
      page: '2',
      pageSize: '20',
      q: 'Ana',
    });
    expect(memberListQuery({ page: 1 })).toEqual({
      page: '1',
      pageSize: '20',
      q: '',
    });

    const page = readFileSync(resolve(dir, 'access-page.tsx'), 'utf8');
    expect(page).toContain('listMembersRequest({');
    expect(page).toContain('q: term');
    expect(page).toContain('page,');
    expect(page).toContain('pageSize: memberPageSize');
  });

  it('renders company removal with the destructive variant', () => {
    const page = readFileSync(resolve(dir, 'access-page.tsx'), 'utf8');
    const trigger = page.slice(
      page.lastIndexOf('<AlertDialogTrigger'),
      page.indexOf('<RemovalConfirmDialog'),
    );

    expect(trigger).toContain('variant="destructive"');
    expect(trigger).toContain('<Trash2 />');
    expect(trigger).toContain('Remover');
    expect(trigger).not.toContain('variant="ghost"');
    expect(trigger).not.toContain('variant="outline"');

    const department = readFileSync(
      resolve(dir, 'department-member-row.tsx'),
      'utf8',
    );
    expect(department).toContain('variant="destructive"');
    expect(department).toContain('<UserMinus />');
    expect(department).not.toContain('variant="ghost"');
  });

  it('pages with icon buttons and a page select', () => {
    const ui = readFileSync(resolve(dir, 'member-list-ui.tsx'), 'utf8');

    expect(ui).toContain('aria-label="Página anterior"');
    expect(ui).toContain('aria-label="Próxima página"');
    expect(ui).toContain('total <= pageSize');
    expect(ui).not.toMatch(/>\s*Anterior\s*</);
    expect(ui).not.toMatch(/>\s*Próxima\s*</);
    expect(ui).not.toContain('de {total}');

    const page = readFileSync(resolve(dir, 'access-page.tsx'), 'utf8');
    const departmentList = readFileSync(
      resolve(dir, 'department-member-list.tsx'),
      'utf8',
    );

    expect(page).toContain('onPageChange={onPageChange}');
    expect(page).toContain('roleBadgeVariant(member.role)');
    expect(departmentList).toContain('<MemberPager');
    expect(departmentList).toContain('onPageChange={onPageChange}');
    expect(departmentList).not.toContain('Anterior');
    expect(roleBadgeVariant('OWNER')).not.toBe(roleBadgeVariant('USER'));
  });
});
