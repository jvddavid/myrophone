import {
  formatBrlFromCents,
  nextMaskDigits,
  parseBrlToCents,
} from "@myrophone/shared"

export function readCurrencyCents(currentCents: number, raw: string): number {
  return parseBrlToCents(nextMaskDigits(formatBrlFromCents(currentCents), raw))
}
