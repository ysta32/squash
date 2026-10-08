import type { ReactNode } from 'react'
import { cn } from '../../lib/utils'
import { Label } from './Label'

/**
 * A titled block of settings or content, set as a ledger section: a hairline rule on top, an
 * optional mono eyebrow, the heading and description, the content, then a footer row of actions.
 * No card chrome. The danger tone keeps its content in a bordered block (DESIGN.md "Settings").
 */
export function Section({
  title,
  eyebrow,
  description,
  children,
  footer,
  tone = 'default',
  className,
}: {
  title: string
  /** Mono uppercase label above the heading ("WORKSPACE", "DANGER ZONE"). */
  eyebrow?: string
  description?: ReactNode
  children?: ReactNode
  footer?: ReactNode
  tone?: 'default' | 'danger'
  className?: string
}) {
  const danger = tone === 'danger'
  return (
    <section className={cn('border-t border-line-2 pt-5', className)}>
      <div className={cn(danger && 'rounded-lg border border-danger/40 p-4 sm:p-5')}>
        <header className="max-w-[68ch]">
          {eyebrow && (
            <Label as="p" tone={danger ? 'danger' : 'muted'} className="mb-2">
              {eyebrow}
            </Label>
          )}
          <h2 className={cn('text-lg font-semibold', danger ? 'text-danger' : 'text-ink')}>
            {title}
          </h2>
          {description && <p className="mt-1 text-sm text-ink-2">{description}</p>}
        </header>
        {children && <div className="mt-5">{children}</div>}
        {footer && (
          <div
            className={cn(
              'mt-5 flex flex-wrap items-center justify-end gap-x-3 gap-y-2 border-t pt-4',
              danger ? 'border-danger/25' : 'border-line',
            )}
          >
            {footer}
          </div>
        )}
      </div>
    </section>
  )
}
