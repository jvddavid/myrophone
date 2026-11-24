import type { ComponentProps, ReactNode } from "react"

import { fieldIcons, type FieldIconName } from "@/components/ui/field-icons"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupTextarea,
} from "@/components/ui/input-group"
import { cn } from "@/lib/utils"

function IconField({
  icon,
  disabled,
  align,
  children,
}: {
  icon: FieldIconName
  disabled?: boolean
  align: "center" | "start"
  children: ReactNode
}) {
  const Icon = fieldIcons[icon]

  return (
    <InputGroup
      className={cn("min-w-0", align === "start" && "items-start")}
      data-disabled={disabled ? true : undefined}
    >
      <InputGroupAddon
        aria-hidden="true"
        className={cn("shrink-0", align === "start" && "self-start pt-2.5")}
      >
        <Icon />
      </InputGroupAddon>
      {children}
    </InputGroup>
  )
}

export function IconInput({
  icon,
  disabled,
  className,
  ...props
}: ComponentProps<"input"> & { icon: FieldIconName }) {
  return (
    <IconField align="center" disabled={disabled} icon={icon}>
      <InputGroupInput
        {...props}
        className={cn("min-w-0 w-auto", className)}
        disabled={disabled}
      />
    </IconField>
  )
}

export function IconTextarea({
  icon,
  disabled,
  className,
  ...props
}: ComponentProps<"textarea"> & { icon: FieldIconName }) {
  return (
    <IconField align="start" disabled={disabled} icon={icon}>
      <InputGroupTextarea
        {...props}
        className={cn("min-w-0 w-auto resize pl-2", className)}
        disabled={disabled}
      />
    </IconField>
  )
}
