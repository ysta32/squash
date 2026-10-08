import { useCallback, useEffect, useId, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { Check, ChevronDown } from 'lucide-react'
import { useDismiss } from '../hooks/useDismiss'
import { SEVERITIES, SEVERITY_COLOR, SEVERITY_LABEL } from '../lib/types'
import type { Severity } from '../lib/types'
import { cn } from '../lib/utils'
import { Kbd } from './ui'

const TICKS: Record<Severity, number> = { low: 1, medium: 2, high: 3, critical: 4 }

/**
 * Field-notebook meter for a severity: four 2px × 8px slots with 2px gaps; the first 1–4 are
 * filled in the severity colour and the rest stay `--border-2`, so Low reads as 1/4 and Critical
 * as 4/4 without relying on colour alone. Always 14px wide to sit in a column.
 */
export function SeverityTicks({ severity, className }: { severity: Severity; className?: string }) {
  const filled = TICKS[severity]
  return (
    <span
      aria-hidden="true"
      data-ticks={filled}
      className={cn('inline-flex h-[8px] w-[14px] shrink-0 items-stretch gap-[2px]', className)}
    >
      {[1, 2, 3, 4].map((slot) => (
        <span
          key={slot}
          className={cn(
            'w-[2px] rounded-xs',
            slot <= filled ? SEVERITY_COLOR[severity] : 'bg-line-2',
          )}
        />
      ))}
    </span>
  )
}

interface SeverityPickerProps {
  value: Severity
  onChange: (value: Severity) => void
  /**
   * sm: h-7 trigger for dense headers; md: h-8 trigger matching toolbar icon buttons;
   * quiet: borderless property control (bug detail toolbar), 44px tall on touch.
   */
  size?: 'sm' | 'md' | 'quiet'
  disabled?: boolean
  /** Which edge of the trigger the menu aligns to. */
  align?: 'start' | 'end'
  /** Trigger tooltip, e.g. to advertise a shortcut that the host handles. */
  title?: string
  /**
   * Below `sm` the bordered trigger shrinks to a 32px ticks-only square (label kept for screen
   * readers); its hit area still reaches 44px for touch.
   */
  compact?: boolean
  className?: string
}

/**
 * Compact severity control: a button showing the current severity (dot + label) that opens a
 * listbox of all four. Inside the open list, ↑/↓/Home/End move, Enter/Space pick, 1–4 pick directly,
 * Esc/Tab close. On the closed trigger, ↑/↓ open the list and 1–4 change the value directly.
 */
export function SeverityPicker({
  value,
  onChange,
  size = 'md',
  disabled = false,
  align = 'end',
  title = 'Severity',
  compact = false,
  className,
}: SeverityPickerProps) {
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(() => SEVERITIES.indexOf(value))
  const rootRef = useRef<HTMLDivElement | null>(null)
  const triggerRef = useRef<HTMLButtonElement | null>(null)
  const listRef = useRef<HTMLDivElement | null>(null)
  const listId = useId()

  const close = useCallback(() => setOpen(false), [])
  useDismiss(rootRef, close, open)

  useEffect(() => {
    if (open) listRef.current?.focus()
  }, [open])

  const show = () => {
    setActive(SEVERITIES.indexOf(value))
    setOpen(true)
  }

  const pick = (s: Severity) => {
    setOpen(false)
    triggerRef.current?.focus()
    if (s !== value) onChange(s)
  }

  const digit = (e: KeyboardEvent<HTMLElement>): Severity | undefined => {
    if (e.altKey || e.ctrlKey || e.metaKey) return undefined
    return SEVERITIES[Number(e.key) - 1]
  }

  const onTriggerKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    const next = digit(e)
    if (next) {
      e.preventDefault()
      if (next !== value) onChange(next)
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      show()
    }
  }

  const onListKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const next = digit(e)
    const n = SEVERITIES.length
    if (next) {
      e.preventDefault()
      pick(next)
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((i) => (i + (e.key === 'ArrowDown' ? 1 : -1) + n) % n)
    } else if (e.key === 'Home' || e.key === 'End') {
      e.preventDefault()
      setActive(e.key === 'Home' ? 0 : n - 1)
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      const s = SEVERITIES[active]
      if (s) pick(s)
    } else if (e.key === 'Escape') {
      e.preventDefault()
      e.stopPropagation()
      setOpen(false)
      triggerRef.current?.focus()
    } else if (e.key === 'Tab') {
      setOpen(false)
    }
  }

  const optionId = (i: number) => `${listId}-${i}`

  return (
    <div ref={rootRef} className={cn('relative inline-flex', className)}>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-label={`Severity: ${SEVERITY_LABEL[value]}`}
        title={title}
        onClick={() => (open ? close() : show())}
        onKeyDown={onTriggerKeyDown}
        className={cn(
          't focus-ring inline-flex shrink-0 items-center gap-2 rounded-md font-medium text-ink hover:bg-surface-3 disabled:pointer-events-none disabled:text-ink-3',
          size === 'quiet'
            ? 'h-8 px-2 text-sm pointer-coarse:h-[3.1429rem]'
            : cn(
                'border border-line-2 bg-transparent text-xs hover:border-line-input',
                size === 'sm' ? 'h-7 px-2' : 'h-8 px-2.5',
                compact &&
                  "relative max-sm:size-[2.2857rem] max-sm:justify-center max-sm:px-0 max-sm:before:absolute max-sm:before:-inset-[6px] max-sm:before:content-['']",
              ),
          open && 'bg-surface-3',
        )}
      >
        <SeverityTicks severity={value} />
        <span className={cn(compact && 'max-sm:sr-only')}>{SEVERITY_LABEL[value]}</span>
        <ChevronDown
          size={14}
          strokeWidth={1.5}
          absoluteStrokeWidth
          aria-hidden="true"
          className={cn('t -mr-0.5 text-ink-3', open && 'rotate-180', compact && 'max-sm:hidden')}
        />
      </button>
      {open && (
        <div
          ref={listRef}
          id={listId}
          role="listbox"
          aria-label="Severity"
          tabIndex={-1}
          aria-activedescendant={optionId(active)}
          onKeyDown={onListKeyDown}
          className={cn(
            'panel absolute top-full z-30 mt-1 w-44 animate-in p-1 outline-none',
            align === 'end' ? 'right-0' : 'left-0',
          )}
        >
          {SEVERITIES.map((s, i) => {
            const selected = s === value
            return (
              <div
                key={s}
                id={optionId(i)}
                role="option"
                aria-selected={selected}
                onPointerMove={() => setActive(i)}
                onClick={() => pick(s)}
                className={cn(
                  'flex h-8 cursor-pointer items-center gap-2 rounded-md px-2 text-sm text-ink pointer-coarse:h-[3.1429rem]',
                  i === active && 'bg-surface-3',
                )}
              >
                <SeverityTicks severity={s} />
                <span className={cn('flex-1', selected && 'font-medium')}>{SEVERITY_LABEL[s]}</span>
                {selected && (
                  <Check
                    size={16}
                    strokeWidth={1.5}
                    absoluteStrokeWidth
                    aria-hidden="true"
                    className="text-ink-2"
                  />
                )}
                <span aria-hidden="true">
                  <Kbd>{i + 1}</Kbd>
                </span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
