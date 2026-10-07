import type { ReactNode } from 'react'
import { cn } from '../../lib/utils'

export function Kbd({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <kbd
      className={cn(
        'inline-flex h-5 min-w-5 items-center justify-center rounded border border-border bg-bg-subtle px-1 font-sans text-[11px] font-medium text-muted',
        className,
      )}
    >
      {children}
    </kbd>
  )
}
