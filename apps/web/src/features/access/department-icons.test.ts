import { describe, expect, it } from 'vitest';
import {
  departmentIconByKey,
  departmentIconPayloadKey,
  departmentIcons,
  selectedDepartmentIconKey,
} from './department-icons';

describe('department icon catalog', () => {
  it('builds the payload key from the selected catalog entry', () => {
    const selected = departmentIcons[4];

    expect(departmentIcons).toHaveLength(80);
    expect(selected?.key).toBe('file-text');
    expect(departmentIconPayloadKey('file-text')).toBe('file-text');
    expect(departmentIconByKey.get('file-text')?.label).toBe('Documento');
  });

  it('does not offer an unknown key', () => {
    expect(departmentIconPayloadKey('not-a-real-icon')).toBeNull();
    expect(departmentIconByKey.has('not-a-real-icon')).toBe(false);
    expect(selectedDepartmentIconKey('not-a-real-icon')).toBe('folder');
  });
});
