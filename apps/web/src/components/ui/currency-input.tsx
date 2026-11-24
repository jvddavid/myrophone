import { formatBrlFromCents } from "@myrophone/shared"
import { type ChangeEvent, useCallback } from "react"

import { readCurrencyCents } from "@/components/ui/currency-input-model"
import { Field, FieldLabel } from "@/components/ui/field"
import { IconInput } from "@/components/ui/icon-input"
import { placeCaretAtEnd, scheduleCaretAtEnd } from "@/components/ui/mask-caret"

export function CurrencyInput({
  id,
  label,
  value,
  onChange,
  disabled = false,
  name,
}: {
  id: string
  label: string
  value: number
  onChange: (cents: number) => void
  disabled?: boolean
  name?: string
}) {
  const onInput = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      onChange(readCurrencyCents(value, event.currentTarget.value))
      scheduleCaretAtEnd(event.currentTarget)
    },
    [onChange, value],
  )

  return (
    <Field data-disabled={disabled ? true : undefined}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <IconInput
        autoComplete="off"
        disabled={disabled}
        icon="currency"
        id={id}
        inputMode="numeric"
        name={name}
        onChange={onInput}
        onFocus={placeCaretAtEnd}
        onSelect={placeCaretAtEnd}
        value={formatBrlFromCents(value)}
      />
    </Field>
  )
}
