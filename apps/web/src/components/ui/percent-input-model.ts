import {
  formatBrazilPercent,
  nextMaskDigits,
  parseBrazilPercent,
} from "@myrophone/shared"

export function readPercentValue(current: number, raw: string): number {
  return parseBrazilPercent(nextMaskDigits(formatBrazilPercent(current), raw))
}
