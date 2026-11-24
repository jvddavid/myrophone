import { formatBrazilPhone, nextMaskDigits } from "@myrophone/shared"

export function readPhoneDigits(current: string, raw: string): string {
  return nextMaskDigits(formatBrazilPhone(current), raw).slice(0, 11)
}
