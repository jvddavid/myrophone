import { formatBrazilPhone } from "@myrophone/shared"
import { type ChangeEvent, useCallback } from "react"

import { Field, FieldError, FieldLabel } from "@/components/ui/field"
import { IconInput } from "@/components/ui/icon-input"
import { placeCaretAtEnd, scheduleCaretAtEnd } from "@/components/ui/mask-caret"
import { readPhoneDigits } from "@/components/ui/phone-input-model"

export function PhoneInput({
  id,
  value,
  onChange,
  disabled = false,
  required = false,
  name = "phone",
  error = null,
  autoComplete = "tel",
}: {
  id: string
  value: string
  onChange: (digits: string) => void
  disabled?: boolean
  required?: boolean
  name?: string
  error?: string | null
  autoComplete?: string
}) {
  const onInput = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      onChange(readPhoneDigits(value, event.currentTarget.value))
      scheduleCaretAtEnd(event.currentTarget)
    },
    [onChange, value],
  )

  return (
    <Field
      data-disabled={disabled ? true : undefined}
      data-invalid={error ? true : undefined}
    >
      <FieldLabel htmlFor={id}>Telefone</FieldLabel>
      <IconInput
        aria-invalid={error ? true : undefined}
        autoComplete={autoComplete}
        disabled={disabled}
        icon="phone"
        id={id}
        inputMode="numeric"
        name={name}
        onChange={onInput}
        onFocus={placeCaretAtEnd}
        onSelect={placeCaretAtEnd}
        required={required}
        type="tel"
        value={formatBrazilPhone(value)}
      />
      {error ? <FieldError>{error}</FieldError> : null}
    </Field>
  )
}
