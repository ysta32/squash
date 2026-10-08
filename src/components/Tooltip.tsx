import { useEffect, useRef, useState } from 'react'
import type { FocusEvent, PointerEvent, ReactNode } from 'react'
import { cn } from '../lib/utils'

export interface TooltipProps {
  /** Short label; the wrapped control still needs its own aria-label (the tip is decorative). */
  label: string
  /** Keyboard shortcut shown as a mono key hint, e.g. "?" or "⌘K". */
  shortcut?: string
  /** Edge the tip lines up with; use 'end' for controls near the right edge of the screen. */
  align?: 'start' | 'center' | 'end'
  /** Hide the tip, e.g. while the control's own popover is open. */
  disabled?: boolean
  children: ReactNode
  className?: string
}

const ALIGN = {
  start: 'left-0',
  center: 'left-1/2 -translate-x-1/2',
  end: 'right-0',
}

/** Hover intent before the tip appears; keyboard focus shows it at once. */
export const TOOLTIP_DELAY = 300

function isFocusVisible(element: Element): boolean {
  try {
    return element.matches(':focus-visible')
  } catch {
    // Engines without :focus-visible: treat any focus as keyboard focus.
    return true
  }
}

/**
 * Hover / keyboard-focus tooltip for icon buttons (DESIGN.md "Iconography": icon-only buttons get a
 * tooltip with the shortcut). Meets WCAG 1.4.13: Escape dismisses it without moving the pointer or
 * focus, and it stays open while the pointer is over the tip itself (the tip sits inside the
 * hover area, joined to the control by a transparent bridge). Touch pointers never open it.
 */
export function Tooltip({
  label,
  shortcut,
  align = 'center',
  disabled = false,
  children,
  className,
}: TooltipProps) {
  const [hovered, setHovered] = useState(false)
  const [focused, setFocused] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const open = !disabled && !dismissed && (hovered || focused)

  function clearTimer(): void {
    if (timer.current !== null) clearTimeout(timer.current)
    timer.current = null
  }

  useEffect(() => clearTimer, [])

  useEffect(() => {
    if (!open) return
    // Window capture phase, so the tip sees Escape first. A visible tip is the topmost layer, so
    // that Escape closes only the tip: it is stopped here and never reaches document-level
    // dismissers (useDismiss popovers, global shortcuts) or the focused control. The next
    // Escape, with the tip gone, goes through as usual.
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented) return
      event.preventDefault()
      event.stopPropagation()
      setDismissed(true)
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [open])

  function onPointerEnter(event: PointerEvent<HTMLSpanElement>): void {
    if (event.pointerType === 'touch') return
    clearTimer()
    timer.current = setTimeout(() => {
      timer.current = null
      setHovered(true)
    }, TOOLTIP_DELAY)
  }

  function onPointerLeave(): void {
    clearTimer()
    setHovered(false)
    if (!focused) setDismissed(false)
  }

  function onFocus(event: FocusEvent<HTMLSpanElement>): void {
    if (isFocusVisible(event.target)) setFocused(true)
  }

  function onBlur(event: FocusEvent<HTMLSpanElement>): void {
    if (event.currentTarget.contains(event.relatedTarget)) return
    setFocused(false)
    if (!hovered) setDismissed(false)
  }

  return (
    <span
      className={cn('relative inline-flex', className)}
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
      onFocus={onFocus}
      onBlur={onBlur}
    >
      {children}
      {!disabled && (
        <span
          aria-hidden="true"
          data-state={open ? 'open' : 'closed'}
          className={cn(
            // pt-1.5 is the hover bridge between control and tip (no gap that would close it).
            'absolute top-full z-40 pt-1.5 transition-opacity duration-(--dur-micro)',
            open ? 'opacity-100' : 'pointer-events-none opacity-0',
            ALIGN[align],
          )}
        >
          <span className="flex items-center gap-2 rounded-md bg-ink px-2 py-1 text-xs whitespace-nowrap text-bg shadow-elev-2">
            {label}
            {shortcut && <span className="font-mono text-label text-bg/70">{shortcut}</span>}
          </span>
        </span>
      )}
    </span>
  )
}
