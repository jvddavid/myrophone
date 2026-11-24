import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const schema = readFileSync(
  resolve(
    dirname(fileURLToPath(import.meta.url)),
    '../../../prisma/schema.prisma',
  ),
  'utf8',
);

describe('StoredFile schema', () => {
  it('stores the file under the company and keeps the uploader as audit only', () => {
    const start = schema.indexOf('model StoredFile {');
    const block = schema.slice(start);

    expect(block).toMatch(/tenantId\s+String\n/);
    expect(block).toMatch(/onDelete:\s*Cascade/);
    expect(block).toMatch(/uploadedByUserId\s+String\?/);
    expect(block).toMatch(/onDelete:\s*SetNull/);
    expect(block).toMatch(/visibility\s+StoredFileVisibility/);
    expect(block).toMatch(/purpose\s+StoredFilePurpose/);
    expect(block).toMatch(/bucket\s+String/);
    expect(block).toMatch(/objectKey\s+String/);
    expect(block).toMatch(/originalName\s+String/);
    expect(block).toMatch(/contentType\s+String/);
    expect(block).toMatch(/sizeBytes\s+Int/);
    expect(block).toContain('@@unique([bucket, objectKey])');
    expect(block).toContain('@@index([tenantId])');
    expect(block).toContain('@@index([uploadedByUserId])');
    expect(block).not.toMatch(/\n\s+url\s+/);
  });
});
