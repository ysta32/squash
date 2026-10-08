import type { ReactNode } from 'react'
import { cn } from '../../lib/utils'
import { SpecimenLabel, type SpecimenSegment } from '../ui'
import { MK_CONTAINER } from './MarketingLayout'

/**
 * The hook of every non-home marketing page (DESIGN.md sections 6 and 8): a mono specimen
 * eyebrow, one display heading, a short lead, and optional actions or a visual on the right.
 * Cabinet light and ruled paper behind, like the home hero but smaller.
 */
export function PageHero({
  eyebrow,
  title,
  children,
  actions,
  aside,
  id = 'page-heading',
  className,
}: {
  eyebrow: readonly SpecimenSegment[]
  title: ReactNode
  /** The lead paragraph(s). */
  children?: ReactNode
  actions?: ReactNode
  /** Right column at ≥1024px (a visual or a fact panel); stacks under the text below that. */
  aside?: ReactNode
  id?: string
  className?: string
}) {
  return (
    <section
      aria-labelledby={id}
      className={cn('cabinet-light relative isolate overflow-hidden', className)}
    >
      <div
        aria-hidden="true"
        className="mk-ruled pointer-events-none absolute inset-0 -z-10 opacity-40"
      />
      <div
        className={cn(
          MK_CONTAINER,
          'grid gap-y-12 pt-14 pb-16 sm:pt-20 lg:grid-cols-12 lg:gap-x-8 lg:pt-28 lg:pb-24',
        )}
      >
        <div className={aside ? 'lg:col-span-7' : 'lg:col-span-9'}>
          <SpecimenLabel segments={eyebrow} className="text-ink-3" />
          <h1
            id={id}
            className="mt-4 max-w-[20ch] text-[2.5rem]/[2.75rem] font-semibold tracking-[-0.03em] text-balance sm:text-display-m xl:text-[4rem]/[4.25rem] xl:tracking-[-0.035em]"
          >
            {title}
          </h1>
          {children && (
            <div className="mt-6 max-w-[56ch] space-y-4 text-read text-pretty text-ink-2 sm:text-lg sm:leading-8">
              {children}
            </div>
          )}
          {actions && <div className="mt-8 flex flex-wrap items-center gap-3">{actions}</div>}
        </div>
        {aside && <div className="lg:col-span-5 lg:self-end">{aside}</div>}
      </div>
    </section>
  )
}
