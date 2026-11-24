import type { SyntheticEvent } from "react"

let placingCaret = false

export function keepCaretAtEnd(input: HTMLInputElement) {
  if (placingCaret) {
    return
  }

  const end = input.value.length
  const start = input.selectionStart ?? end
  const selectionEnd = input.selectionEnd ?? end

  if (start === 0 && selectionEnd === end) {
    return
  }

  if (start === end && selectionEnd === end) {
    return
  }

  placingCaret = true
  input.setSelectionRange(end, end)
  placingCaret = false
}

export function placeCaretAtEnd(event: SyntheticEvent<HTMLInputElement>) {
  keepCaretAtEnd(event.currentTarget)
}

export function scheduleCaretAtEnd(input: HTMLInputElement) {
  requestAnimationFrame(() => {
    if (!input.isConnected) {
      return
    }

    keepCaretAtEnd(input)
  })
}
