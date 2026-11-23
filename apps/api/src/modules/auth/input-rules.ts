import { AppError } from '../../core/errors/app-error';

const MIN_NAME_LENGTH = 2;

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

export function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code: unknown }).code === 'P2002'
  );
}
