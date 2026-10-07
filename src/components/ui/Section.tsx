import type { ReactNode } from 'react'
import { cn } from '../../lib/utils'

/** A titled block of settings or content, with an optional description and footer actions. */
export function Section({
  title,
  description,
  children,
  footer,
  tone = 'default',
  className,
}: {
  title: string
  description?: ReactNode
  children?: ReactNode
  footer?: ReactNode
  tone?: 'default' | 'danger'
  className?: string
}) {
  return (
    <section
      className={cn(
        'overflow-hidden rounded-xl border bg-bg shadow-xs',
        tone === 'danger' ? 'border-danger/40' : 'border-border',
        className,
      )}
    >
      <div className="space-y-5 p-5">
        <header className="space-y-1">
          <h2
            className={cn(
              'text-[15px] leading-6 font-semibold tracking-tight',
              tone === 'danger' && 'text-danger',
            )}
          >
            {title}
          </h2>
          {description && <p className="text-sm leading-relaxed text-muted">{description}</p>}
        </header>
        {children}
      </div>
      {footer && (
        <div
          className={cn(
            'flex min-h-12 flex-wrap items-center justify-end gap-x-3 gap-y-2 border-t px-5 py-2.5',
            tone === 'danger' ? 'border-danger/30 bg-danger/5' : 'border-border bg-bg-subtle/60',
          )}
        >
          {footer}
        </div>
      )}
    </section>
  )
}
