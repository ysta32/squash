import type { ReactNode } from 'react'
import { cn } from '../../lib/utils'
import { labelClass } from './styles'

export type BadgeTone = 'neutral' | 'accent' | 'success' | 'warning' | 'danger'

// Specimen-label chips: mono uppercase on a hairline. Status colors are text and border only;
// the accent is the one tone with a (same-hue) tint behind its text.
const TONE: Record<BadgeTone, string> = {
  neutral: 'border-line-2 text-ink-2',
  accent: 'border-transparent bg-accent-tint text-accent',
  success: 'border-success/40 text-success',
  warning: 'border-warning/40 text-warning',
  danger: 'border-danger/40 text-danger',
}

export function Badge({
  tone = 'neutral',
  children,
  className,
}: {
  tone?: BadgeTone
  children: ReactNode
  className?: string
}) {
  return (
    <span
      className={cn(
        'inline-flex h-5 items-center gap-1 rounded-sm border px-1.5 leading-none whitespace-nowrap',
        labelClass,
        TONE[tone],
        className,
        // Labels are always uppercase, even when a caller asks for `capitalize`.
        'uppercase!',
      )}
    >
      {children}
    </span>
  )
}
