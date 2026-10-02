import type { KeyboardEvent } from 'react'
import { SEVERITIES, SEVERITY_COLOR, SEVERITY_LABEL } from '../lib/types'
import type { Severity } from '../lib/types'
import { cn } from '../lib/utils'

interface SeverityPickerProps {
  value: Severity
  onChange: (value: Severity) => void
  size?: 'sm' | 'md'
}

export function SeverityPicker({ value, onChange, size = 'md' }: SeverityPickerProps) {
  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (e.altKey || e.ctrlKey || e.metaKey) return
    const idx = Number(e.key) - 1
    const next = SEVERITIES[idx]
    if (next) {
      e.preventDefault()
      onChange(next)
    }
  }

  return (
    <div
      role="radiogroup"
      aria-label="Severity"
      className="flex items-center gap-1"
      title="Severity (Alt+1–4)"
    >
      {SEVERITIES.map((s) => (
        <button
          key={s}
          type="button"
          role="radio"
          aria-checked={value === s}
          aria-label={SEVERITY_LABEL[s]}
          title={`${SEVERITY_LABEL[s]} (Alt+${SEVERITIES.indexOf(s) + 1})`}
          onClick={() => onChange(s)}
          onKeyDown={onKeyDown}
          className="flex h-5 w-5 items-center justify-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
        >
          <span
            className={cn(
              'rounded-full transition-all',
              size === 'sm' ? 'h-2 w-2' : 'h-2.5 w-2.5',
              SEVERITY_COLOR[s],
              value === s
                ? 'opacity-100 ring-2 ring-offset-1 ring-current/40'
                : 'opacity-35 hover:opacity-70',
            )}
          />
        </button>
      ))}
    </div>
  )
}
