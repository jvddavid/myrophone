import { AppError } from '../../core/errors/app-error';

const MIN_NAME_LENGTH = 2;
const MIN_DESCRIPTION_LENGTH = 2;
const MAX_DESCRIPTION_LENGTH = 280;
const MAX_LOGO_URL_LENGTH = 2048;

export function normalizeName(value: string, label: string): string {
  const name = value.trim();

  if (name.length < MIN_NAME_LENGTH) {
    throw new AppError({
      statusCode: 400,
      code: 'VALIDATION_ERROR',
      message: `${label} must have at least ${MIN_NAME_LENGTH} characters.`,
    });
  }

  return name;
}

export function normalizeDescription(value: string): string {
  const description = value.trim();

  if (
    description.length < MIN_DESCRIPTION_LENGTH ||
    description.length > MAX_DESCRIPTION_LENGTH
  ) {
    throw new AppError({
      statusCode: 400,
      code: 'VALIDATION_ERROR',
      message: `Company description must have between ${MIN_DESCRIPTION_LENGTH} and ${MAX_DESCRIPTION_LENGTH} characters.`,
    });
  }

  return description;
}

export function normalizeLogoUrl(
  value: string | undefined | null,
): string | null {
  if (value == null) {
    return null;
  }

  const logoUrl = value.trim();

  if (logoUrl.length === 0) {
    return null;
  }

  let url: URL;

  try {
    url = new URL(logoUrl);
  } catch {
    throw invalidLogoUrl();
  }

  if (
    (url.protocol !== 'http:' && url.protocol !== 'https:') ||
    logoUrl.length > MAX_LOGO_URL_LENGTH
  ) {
    throw invalidLogoUrl();
  }

  return logoUrl;
}

function invalidLogoUrl(): AppError {
  return new AppError({
    statusCode: 400,
    code: 'VALIDATION_ERROR',
    message: 'Company logo must be an http or https address.',
  });
}

export function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code: unknown }).code === 'P2002'
  );
}
