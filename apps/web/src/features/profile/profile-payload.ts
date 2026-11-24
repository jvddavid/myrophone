import { brazilPhoneDigits } from '@myrophone/shared';

export function profileUpdatePayload(input: {
  name: string;
  phone: string;
  email?: string;
}): { name: string; phone: string } {
  return {
    name: input.name.trim(),
    phone: brazilPhoneDigits(input.phone),
  };
}
