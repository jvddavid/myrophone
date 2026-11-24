import { describe, expect, it } from 'vitest';
import { AppError } from '../../core/errors/app-error';
import {
  assertPurposeVisibility,
  assertUploadRules,
  buildObjectKey,
  buildPublicObjectUrl,
  MAX_FILE_BYTES,
} from './rules';

describe('stored file rules', () => {
  it('rejects a purpose and visibility mismatch', () => {
    expect(() => assertPurposeVisibility('AVATAR', 'PRIVATE')).toThrow(
      AppError,
    );
    expect(() => assertPurposeVisibility('DOCUMENT', 'PUBLIC')).toThrow(
      AppError,
    );

    try {
      assertPurposeVisibility('VALIDATION', 'PUBLIC');
    } catch (error) {
      expect(error).toMatchObject({
        statusCode: 422,
        code: 'FILE_VISIBILITY_MISMATCH',
      });
    }
  });

  it('accepts the visibility derived from each purpose', () => {
    expect(() => assertPurposeVisibility('AVATAR', 'PUBLIC')).not.toThrow();
    expect(() => assertPurposeVisibility('LOGO', 'PUBLIC')).not.toThrow();
    expect(() =>
      assertPurposeVisibility('PUBLIC_IMAGE', 'PUBLIC'),
    ).not.toThrow();
    expect(() => assertPurposeVisibility('DOCUMENT', 'PRIVATE')).not.toThrow();
    expect(() =>
      assertPurposeVisibility('VALIDATION', 'PRIVATE'),
    ).not.toThrow();
  });

  it('rejects a content type that the visibility does not allow', () => {
    expect(() =>
      assertUploadRules({
        purpose: 'AVATAR',
        visibility: 'PUBLIC',
        contentType: 'application/pdf',
        sizeBytes: 12,
      }),
    ).toThrow(
      expect.objectContaining({
        statusCode: 422,
        code: 'INVALID_CONTENT_TYPE',
      }),
    );

    expect(() =>
      assertUploadRules({
        purpose: 'DOCUMENT',
        visibility: 'PRIVATE',
        contentType: 'application/zip',
        sizeBytes: 12,
      }),
    ).toThrow(
      expect.objectContaining({
        code: 'INVALID_CONTENT_TYPE',
      }),
    );
  });

  it('accepts images on public files and pdf on private files', () => {
    expect(
      assertUploadRules({
        purpose: 'PUBLIC_IMAGE',
        visibility: 'PUBLIC',
        contentType: 'image/png; charset=binary',
        sizeBytes: 4,
      }),
    ).toBe('image/png');

    expect(
      assertUploadRules({
        purpose: 'DOCUMENT',
        visibility: 'PRIVATE',
        contentType: 'application/pdf',
        sizeBytes: 4,
      }),
    ).toBe('application/pdf');
  });

  it('rejects an empty file and a file over 5 MB', () => {
    expect(() =>
      assertUploadRules({
        purpose: 'AVATAR',
        visibility: 'PUBLIC',
        contentType: 'image/jpeg',
        sizeBytes: 0,
      }),
    ).toThrow(expect.objectContaining({ code: 'EMPTY_FILE' }));

    expect(() =>
      assertUploadRules({
        purpose: 'AVATAR',
        visibility: 'PUBLIC',
        contentType: 'image/jpeg',
        sizeBytes: MAX_FILE_BYTES + 1,
      }),
    ).toThrow(
      expect.objectContaining({
        statusCode: 413,
        code: 'FILE_TOO_LARGE',
      }),
    );
  });

  it('builds an object key with the tenant id and not the original filename', () => {
    const key = buildObjectKey('tenant-1');

    expect(key.startsWith('tenant-1/')).toBe(true);
    expect(key).not.toContain('contrato-secreto');
    expect(key).not.toContain('.pdf');
  });

  it('builds a stable public URL from the public base', () => {
    const base = 'http://127.0.0.1:9000/myrophone-public/';
    const key = 'tenant-1/6f1c5c3e-6b1a-4d0e-9a4a-3d6e2a1b9c70';
    const first = buildPublicObjectUrl(base, key);
    const second = buildPublicObjectUrl(base, key);

    expect(first).toBe(second);
    expect(first).toContain('http://127.0.0.1:9000/myrophone-public/');
    expect(first).toBe(`http://127.0.0.1:9000/myrophone-public/${key}`);
  });
});
