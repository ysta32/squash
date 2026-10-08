import type { ReactNode } from 'react'
import { cn } from '../../lib/utils'

type KbdTone = 'default' | 'accent'

const TONE: Record<KbdTone, string> = {
  default: 'border-line-2 border-b-line-input/60 bg-surface-3 text-ink-2',
  // On an accent-filled button (e.g. the capture bar's File).
  accent: 'border-accent-fg/40 bg-transparent text-accent-fg',
}

/**
 * A key cap: one key per cap (⌘ and V are two caps; use `Keys` for a chord). Every cap is the same
 * 20px tall with a 20px minimum width, mono label on a sunken surface with a heavier bottom edge.
 */
export function Kbd({
  children,
  className,
  tone = 'default',
}: {
  children: ReactNode
  className?: string
  tone?: KbdTone
}) {
  return (
    <kbd
      className={cn(
        'inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-sm border border-b-2 px-1 font-mono text-label leading-none font-medium tabular-nums',
        TONE[tone],
        className,
      )}
    >
      {children}
    </kbd>
  )
}

/** A chord or sequence: each key in its own cap, e.g. `<Keys keys={[MOD_KEY, 'V']} />`. */
export function Keys({
  keys,
  className,
  tone,
}: {
  keys: readonly string[]
  className?: string
  tone?: KbdTone
}) {
  return (
    <span className={cn('inline-flex items-center gap-0.5 align-middle', className)}>
      {keys.map((k, i) => (
        <Kbd key={`${i}-${k}`} tone={tone}>
          {k}
        </Kbd>
      ))}
    </span>
  )
}
