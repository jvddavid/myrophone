import { formatBrazilPercent } from "@myrophone/shared"
import { type ChangeEvent, useCallback } from "react"

import { Field, FieldLabel } from "@/components/ui/field"
import { IconInput } from "@/components/ui/icon-input"
import { placeCaretAtEnd, scheduleCaretAtEnd } from "@/components/ui/mask-caret"
import { readPercentValue } from "@/components/ui/percent-input-model"

export function PercentInput({
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
  onChange: (percent: number) => void
  disabled?: boolean
  name?: string
}) {
  const onInput = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      onChange(readPercentValue(value, event.currentTarget.value))
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
        icon="percent"
        id={id}
        inputMode="numeric"
        name={name}
        onChange={onInput}
        onFocus={placeCaretAtEnd}
        onSelect={placeCaretAtEnd}
        value={formatBrazilPercent(value)}
      />
    </Field>
  )
}
