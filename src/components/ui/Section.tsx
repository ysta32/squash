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
        'overflow-hidden rounded-xl border bg-bg',
        tone === 'danger' ? 'border-danger/40' : 'border-border',
        className,
      )}
    >
      <div className="space-y-4 p-5">
        <header className="space-y-1">
          <h2 className={cn('text-base font-semibold', tone === 'danger' && 'text-danger')}>
            {title}
          </h2>
          {description && <p className="text-sm text-muted">{description}</p>}
        </header>
        {children}
      </div>
      {footer && (
        <div className="flex items-center justify-end gap-2 border-t border-border bg-bg-subtle px-5 py-3">
          {footer}
        </div>
      )}
    </section>
  )
}
