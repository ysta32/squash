import type { ReactNode } from 'react'
import { cn } from '../../lib/utils'
import { SpecimenLabel } from '../ui'
import { MK_CONTAINER, MarketingLayout } from './MarketingLayout'

/** Format a YYYY-MM-DD day as `07 OCT 2026` for the specimen label (UTC, never off by one). */
function labelDay(isoDay: string): string {
  return new Date(`${isoDay}T00:00:00Z`)
    .toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      timeZone: 'UTC',
    })
    .toUpperCase()
}

/**
 * Privacy and Terms: the marketing nav and footer, a mono "Last updated" label, and the body in
 * the reading style on a 68ch measure, with an outline of its sections on wide screens.
 */
export function LegalLayout({
  title,
  updated,
  lead,
  sections,
}: {
  title: string
  /** YYYY-MM-DD */
  updated: string
  lead: ReactNode
  sections: { id: string; title: string; body: ReactNode }[]
}) {
  return (
    <MarketingLayout>
      <div className="cabinet-light border-b border-line">
        <div className={cn(MK_CONTAINER, 'pt-12 pb-12 lg:pt-20 lg:pb-16')}>
          <SpecimenLabel
            segments={[
              'Legal',
              <>
                Last updated <time dateTime={updated}>{labelDay(updated)}</time>
              </>,
            ]}
            className="text-ink-3"
          />
          <h1
            id="page-heading"
            className="mt-4 text-[2.5rem]/[2.75rem] font-semibold tracking-[-0.03em] sm:text-display-m"
          >
            {title}
          </h1>
          <div className="mt-5 max-w-[60ch] text-read text-pretty text-ink-2 sm:text-lg sm:leading-8">
            {lead}
          </div>
        </div>
      </div>
      <div className={cn(MK_CONTAINER, 'grid gap-10 py-12 lg:grid-cols-12 lg:gap-8 lg:py-16')}>
        <nav aria-label="Sections" className="max-lg:hidden lg:col-span-3">
          <ol className="sticky top-28 space-y-1">
            {sections.map((section, i) => (
              <li key={section.id}>
                <a
                  href={`#${section.id}`}
                  className="t focus-ring flex gap-3 rounded-sm py-1 text-sm text-ink-2 hover:text-ink"
                >
                  <span className="specimen-label pt-0.5 text-ink-3">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  {section.title}
                </a>
              </li>
            ))}
          </ol>
        </nav>
        <div className="mk-prose min-w-0 lg:col-span-8 lg:col-start-5">
          {sections.map((section, i) => (
            <section key={section.id} aria-labelledby={section.id}>
              <h2 id={section.id} className={cn(i === 0 && '!mt-0 !border-t-0 !pt-0')}>
                <span className="mr-3 font-mono text-sm font-normal text-ink-3">
                  {String(i + 1).padStart(2, '0')}
                </span>
                {section.title}
              </h2>
              {section.body}
            </section>
          ))}
        </div>
      </div>
    </MarketingLayout>
  )
}
