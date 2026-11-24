import { parseBrazilPhone } from '@myrophone/shared';
import { AppError } from '../../core/errors/app-error';

export function normalizePhone(value: string): string {
  const phone = parseBrazilPhone(value);

  if (!phone) {
    throw new AppError({
      statusCode: 400,
      code: 'VALIDATION_ERROR',
      message: 'Phone number is invalid.',
    });
  }

  return phone;
}
