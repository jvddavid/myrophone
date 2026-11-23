import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const schema = readFileSync(
  resolve(dirname(fileURLToPath(import.meta.url)), '../../../prisma/schema.prisma'),
  'utf8',
);

function block(model: string, nextModel: string): string {
  const start = schema.indexOf(`model ${model} {`);
  const end = schema.indexOf(`model ${nextModel} {`);
  return schema.slice(start, end);
}

describe('account schema', () => {
  it('stores the account fields used after email and password registration', () => {
    const user = block('User', 'Permission');

    expect(user).toMatch(/name\s+String\n/);
    expect(user).not.toMatch(/name\s+String\?/);
    expect(user).toMatch(/phone\s+String\s+@default\("00000000"\)/);
    expect(user).toMatch(/avatarUrl\s+String\?/);
    expect(user).toMatch(/emailVerifiedAt\s+DateTime\?/);
    expect(user).toMatch(/lastTenantId\s+String\?/);
    expect(user).toContain('@relation("UserLastTenant"');
  });

  it('allows a session without a company', () => {
    const session = block('Session', 'ActionLog');

    expect(session).toMatch(/tenantId\s+String\?/);
    expect(session).toMatch(/onDelete:\s*SetNull/);
  });
});
