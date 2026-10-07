import type { ReactNode } from 'react'
import { cn } from '../../lib/utils'

/** A key cap: mono label on a sunken surface with a heavier bottom edge. */
export function Kbd({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <kbd
      className={cn(
        'inline-flex h-5 min-w-5 items-center justify-center rounded-sm border border-b-2 border-line-2 border-b-line-input/60 bg-surface-3 px-1 font-mono text-label leading-none font-medium text-ink-2 tabular-nums',
        className,
      )}
    >
      {children}
    </kbd>
  )
}
