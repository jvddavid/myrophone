import { AppError } from '../../core/errors/app-error';

const phonePattern = /^[0-9+()\- ]+$/;

export function normalizePhone(value: string): string {
  const phone = value.trim();

  if (phone.length < 8 || phone.length > 20 || !phonePattern.test(phone)) {
    throw new AppError({
      statusCode: 400,
      code: 'VALIDATION_ERROR',
      message: 'Phone number is invalid.',
    });
  }

  return phone;
}
