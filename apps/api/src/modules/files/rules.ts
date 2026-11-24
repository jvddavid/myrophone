import { AppError } from '../../core/errors/app-error';
import type { StoredFilePurpose, StoredFileVisibility } from './types';

export const MAX_FILE_BYTES = 5 * 1024 * 1024;

const IMAGE_CONTENT_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
]);

const PRIVATE_CONTENT_TYPES = new Set([
  ...IMAGE_CONTENT_TYPES,
  'application/pdf',
]);

const VISIBILITY_BY_PURPOSE = {
  AVATAR: 'PUBLIC',
  LOGO: 'PUBLIC',
  PUBLIC_IMAGE: 'PUBLIC',
  DOCUMENT: 'PRIVATE',
  VALIDATION: 'PRIVATE',
} as const satisfies Record<StoredFilePurpose, StoredFileVisibility>;

const TENANT_ID_PATTERN = /^[A-Za-z0-9_-]+$/;

export function isStoredFilePurpose(value: string): value is StoredFilePurpose {
  return Object.hasOwn(VISIBILITY_BY_PURPOSE, value);
}

export function visibilityForPurpose(
  purpose: StoredFilePurpose,
): StoredFileVisibility {
  return VISIBILITY_BY_PURPOSE[purpose];
}

export function normalizeContentType(value: string): string {
  return value.split(';', 1)[0]?.trim().toLowerCase() ?? '';
}

export function assertPurposeVisibility(
  purpose: StoredFilePurpose,
  visibility: StoredFileVisibility,
): void {
  if (visibilityForPurpose(purpose) !== visibility) {
    throw new AppError({
      statusCode: 422,
      code: 'FILE_VISIBILITY_MISMATCH',
      message: 'File visibility does not match its purpose.',
    });
  }
}

export function assertUploadRules(input: {
  purpose: StoredFilePurpose;
  visibility: StoredFileVisibility;
  contentType: string;
  sizeBytes: number;
}): string {
  assertPurposeVisibility(input.purpose, input.visibility);

  if (!Number.isSafeInteger(input.sizeBytes) || input.sizeBytes <= 0) {
    throw new AppError({
      statusCode: 422,
      code: 'EMPTY_FILE',
      message: 'File is empty.',
    });
  }

  if (input.sizeBytes > MAX_FILE_BYTES) {
    throw new AppError({
      statusCode: 413,
      code: 'FILE_TOO_LARGE',
      message: 'File exceeds the 5 MB limit.',
    });
  }

  const contentType = normalizeContentType(input.contentType);
  const allowed =
    input.visibility === 'PUBLIC' ? IMAGE_CONTENT_TYPES : PRIVATE_CONTENT_TYPES;

  if (!allowed.has(contentType)) {
    throw new AppError({
      statusCode: 422,
      code: 'INVALID_CONTENT_TYPE',
      message: 'File type is not allowed.',
    });
  }

  return contentType;
}

function stripControlCharacters(value: string): string {
  let cleaned = '';

  for (const character of value) {
    const code = character.codePointAt(0) ?? 0;

    if (code <= 31 || code === 127) {
      continue;
    }

    cleaned += character;
  }

  return cleaned;
}

export function sanitizeOriginalName(name: string): string {
  const base = name.replaceAll('\\', '/').split('/').pop() ?? '';
  const cleaned = stripControlCharacters(base).trim();

  if (!cleaned) {
    return 'arquivo';
  }

  return cleaned.slice(0, 255);
}

export function buildObjectKey(tenantId: string): string {
  if (!TENANT_ID_PATTERN.test(tenantId)) {
    throw new AppError({
      statusCode: 400,
      code: 'INVALID_TENANT',
      message: 'Tenant id cannot be used in an object key.',
    });
  }

  return `${tenantId}/${crypto.randomUUID()}`;
}

export function buildPublicObjectUrl(
  baseUrl: string,
  objectKey: string,
): string {
  const base = baseUrl.replace(/\/+$/, '');
  const key = objectKey
    .split('/')
    .map((part) => encodeURIComponent(part))
    .join('/');

  return `${base}/${key}`;
}
