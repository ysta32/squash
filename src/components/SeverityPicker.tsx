import { useCallback, useEffect, useId, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { Check, ChevronDown } from 'lucide-react'
import { useDismiss } from '../hooks/useDismiss'
import { SEVERITIES, SEVERITY_COLOR, SEVERITY_LABEL } from '../lib/types'
import type { Severity } from '../lib/types'
import { cn } from '../lib/utils'

interface SeverityPickerProps {
  value: Severity
  onChange: (value: Severity) => void
  /** sm: h-7 trigger for dense headers; md: h-8 trigger matching toolbar icon buttons. */
  size?: 'sm' | 'md'
  disabled?: boolean
  /** Which edge of the trigger the menu aligns to. */
  align?: 'start' | 'end'
  /** Trigger tooltip, e.g. to advertise a shortcut that the host handles. */
  title?: string
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
          't focus-ring inline-flex shrink-0 items-center gap-1.5 rounded-md border border-border bg-bg font-medium text-fg hover:bg-bg-subtle disabled:pointer-events-none disabled:opacity-50',
          size === 'sm' ? 'h-7 px-2 text-xs' : 'h-8 px-2.5 text-xs',
          open && 'bg-bg-subtle',
        )}
      >
        <span aria-hidden="true" className={cn('h-2 w-2 rounded-full', SEVERITY_COLOR[value])} />
        <span>{SEVERITY_LABEL[value]}</span>
        <ChevronDown
          size={12}
          aria-hidden="true"
          className={cn('t -mr-0.5 text-muted', open && 'rotate-180')}
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
            'absolute top-full z-30 mt-1 w-40 rounded-lg border border-border bg-bg-elevated p-1 shadow-elevated outline-none',
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
                  'flex h-8 cursor-pointer items-center gap-2 rounded-md px-2 text-sm text-fg',
                  i === active && 'bg-bg-subtle',
                )}
              >
                <span
                  aria-hidden="true"
                  className={cn('h-2 w-2 shrink-0 rounded-full', SEVERITY_COLOR[s])}
                />
                <span className="flex-1">{SEVERITY_LABEL[s]}</span>
                {selected && <Check size={14} aria-hidden="true" className="text-muted" />}
                <kbd
                  aria-hidden="true"
                  className="inline-flex h-5 min-w-5 items-center justify-center rounded border border-border bg-bg px-1 font-sans text-[11px] font-medium text-muted"
                >
                  {i + 1}
                </kbd>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
