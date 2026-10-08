import { ArrowLeft, ArrowRight, ChevronRight } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { cn } from '../../lib/utils'
import { SpecimenLabel } from '../ui'
import type { DocHeading } from './content-types'
import { DOC_GROUPS, DOC_LINKS } from './docLinks'
import { MK_CONTAINER, MarketingLayout } from './MarketingLayout'

function SidebarList({ current }: { current: string }) {
  return (
    <div className="space-y-8">
      {DOC_GROUPS.map((group) => (
        <div key={group.id}>
          <p className="specimen-label text-ink-3">{group.title}</p>
          <ul className="mt-2 border-l border-line">
            {DOC_LINKS.filter((doc) => doc.group === group.id).map((doc) => {
              const active = doc.slug === current
              return (
                <li key={doc.slug}>
                  <Link
                    to={doc.path}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      't focus-ring-inset -ml-px flex min-h-9 items-center border-l-2 py-1.5 pl-4 text-sm max-lg:min-h-11',
                      active
                        ? 'border-accent font-medium text-ink'
                        : 'border-transparent text-ink-2 hover:border-line-input hover:text-ink',
                    )}
                  >
                    {doc.title}
                  </Link>
                </li>
              )
            })}
          </ul>
        </div>
      ))}
    </div>
  )
}

function Outline({ headings }: { headings: DocHeading[] }) {
  const items = headings.filter((h) => h.level === 2)
  if (items.length < 2) return null
  return (
    <nav aria-label="On this page" className="sticky top-28">
      <p className="specimen-label text-ink-3">On this page</p>
      <ul className="mt-3 space-y-1">
        {items.map((heading) => (
          <li key={heading.id}>
            <a
              href={`#${heading.id}`}
              className="t focus-ring block rounded-sm py-1 text-sm text-ink-2 hover:text-ink pointer-coarse:py-3"
            >
              {heading.text}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  )
}

function Pager({ current }: { current: string }) {
  const index = DOC_LINKS.findIndex((doc) => doc.slug === current)
  const prev = index > 0 ? DOC_LINKS[index - 1] : null
  const next = index >= 0 && index < DOC_LINKS.length - 1 ? DOC_LINKS[index + 1] : null
  const card =
    't focus-ring group flex min-h-20 flex-col justify-center rounded-lg border border-line px-5 py-4 hover:border-line-input hover:bg-surface-1'
  return (
    <nav aria-label="Previous and next" className="mt-16 grid gap-4 sm:grid-cols-2">
      {prev ? (
        <Link to={prev.path} className={card}>
          <span className="specimen-label flex items-center gap-1.5 text-ink-3">
            <ArrowLeft size={14} aria-hidden="true" /> Previous
          </span>
          <span className="mt-1 text-base font-medium">{prev.title}</span>
        </Link>
      ) : (
        <span />
      )}
      {next && (
        <Link to={next.path} className={cn(card, 'sm:items-end sm:text-right')}>
          <span className="specimen-label flex items-center gap-1.5 text-ink-3">
            Next <ArrowRight size={14} aria-hidden="true" />
          </span>
          <span className="mt-1 text-base font-medium">{next.title}</span>
        </Link>
      )}
    </nav>
  )
}

/**
 * A docs page: the sidebar of every page (a disclosure on phones), the page head, the content on
 * a reading measure, an outline of its sections at ≥1280px, and previous / next links.
 */
export function DocsLayout({
  current,
  headings,
  children,
}: {
  current: string
  headings: DocHeading[]
  children: ReactNode
}) {
  const doc = DOC_LINKS.find((d) => d.slug === current)
  const group = DOC_GROUPS.find((g) => g.id === doc?.group)
  return (
    <MarketingLayout>
      <div className="cabinet-light border-b border-line">
        <div className={cn(MK_CONTAINER, 'pt-10 pb-10 lg:pt-16 lg:pb-14')}>
          <SpecimenLabel
            segments={[
              <Link key="docs" to="/docs" className="t focus-ring rounded-xs hover:text-ink">
                Docs
              </Link>,
              group?.title,
              doc?.title,
            ]}
            className="text-ink-3"
          />
          <h1
            id="page-heading"
            className="mt-4 max-w-[22ch] text-[2.25rem]/[2.5rem] font-semibold tracking-[-0.03em] text-balance sm:text-display-s lg:text-display-m"
          >
            {doc?.title}
          </h1>
          {doc && (
            <p className="mt-4 max-w-[56ch] text-read text-pretty text-ink-2 sm:text-lg sm:leading-8">
              {doc.description}
            </p>
          )}
        </div>
      </div>
      <div className={cn(MK_CONTAINER, 'grid gap-10 py-10 lg:grid-cols-12 lg:gap-8 lg:py-16')}>
        <aside className="lg:col-span-3">
          <details className="group rounded-lg border border-line lg:hidden">
            <summary className="t focus-ring-inset flex min-h-12 cursor-pointer list-none items-center justify-between px-4 text-sm font-medium [&::-webkit-details-marker]:hidden">
              All docs
              <ChevronRight
                size={16}
                aria-hidden="true"
                className="t text-ink-3 group-open:rotate-90"
              />
            </summary>
            <nav aria-label="Docs" className="border-t border-line px-4 py-4">
              <SidebarList current={current} />
            </nav>
          </details>
          <nav aria-label="Docs" className="sticky top-28 max-lg:hidden">
            <SidebarList current={current} />
          </nav>
        </aside>
        <div className="min-w-0 lg:col-span-9 xl:col-span-6">
          {children}
          <Pager current={current} />
        </div>
        <div className="max-xl:hidden xl:col-span-2 xl:col-start-11">
          <Outline headings={headings} />
        </div>
      </div>
    </MarketingLayout>
  )
}
