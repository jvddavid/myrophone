import * as React from "react"
import * as AccordionPrimitive from "@radix-ui/react-accordion"
import { ChevronDown } from "lucide-react"

import { AccordionContent, AccordionItem } from "@/components/ui/accordion"
import { Button } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

export interface AccordionAction {
  type: string
  icon: React.ComponentType<{ className?: string }>
  description: string
}

function stopHeaderAction(event: React.SyntheticEvent) {
  event.stopPropagation()
}

function AccordionActionButton({
  action,
  onAction,
}: {
  action: AccordionAction
  onAction: (type: string) => void
}) {
  const Icon = action.icon

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          aria-label={action.description}
          className="size-8"
          onClick={(event) => {
            stopHeaderAction(event)
            onAction(action.type)
          }}
          onKeyDown={stopHeaderAction}
          onPointerDown={stopHeaderAction}
          size="icon"
          type="button"
          variant="ghost"
        >
          <Icon />
        </Button>
      </TooltipTrigger>
      <TooltipContent>{action.description}</TooltipContent>
    </Tooltip>
  )
}

export function AccordionItemWithActions({
  value,
  title,
  actions,
  onAction,
  children,
  className,
}: {
  value: string
  title: React.ReactNode
  actions: readonly AccordionAction[]
  onAction: (type: string) => void
  children: React.ReactNode
  className?: string
}) {
  return (
    <AccordionItem className={className} value={value}>
      <AccordionPrimitive.Header className="relative flex min-w-0 items-center">
        <AccordionPrimitive.Trigger
          className={cn(
            "flex min-w-0 flex-1 items-center justify-between gap-2 py-3 text-left text-sm font-medium transition-all hover:underline",
            "[&[data-state=open]>svg]:rotate-180"
          )}
        >
          <span className="min-w-0 flex-1 break-words pr-24">{title}</span>
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200" />
        </AccordionPrimitive.Trigger>
        <div className="absolute right-7 top-1/2 z-10 flex -translate-y-1/2 items-center">
          <TooltipProvider delayDuration={300}>
            {actions.map((action) => (
              <AccordionActionButton
                action={action}
                key={action.type}
                onAction={onAction}
              />
            ))}
          </TooltipProvider>
        </div>
      </AccordionPrimitive.Header>
      <AccordionContent>{children}</AccordionContent>
    </AccordionItem>
  )
}
