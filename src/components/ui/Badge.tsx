import type { ReactNode } from 'react'
import { cn } from '../../lib/utils'

export type BadgeTone = 'neutral' | 'accent' | 'success' | 'warning' | 'danger'

const TONE: Record<BadgeTone, string> = {
  neutral: 'border border-border bg-bg-subtle text-muted',
  accent: 'bg-accent/12 text-accent',
  success: 'bg-success/12 text-success',
  warning: 'bg-warning/12 text-warning',
  danger: 'bg-danger/12 text-danger',
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
        'inline-flex h-5 items-center gap-1 rounded-full px-2 text-[11px] leading-none font-medium whitespace-nowrap',
        TONE[tone],
        className,
      )}
    >
      {children}
    </span>
  )
}
