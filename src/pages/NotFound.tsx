import { ArrowRight } from 'lucide-react'
import { useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { MK_CONTAINER, MarketingLayout } from '../components/marketing/MarketingLayout'
import { SpecimenLabel } from '../components/ui'
import { cn } from '../lib/utils'

/** Keeps the page out of search results while it is shown; restores the head afterwards. */
function useNoIndex(title: string) {
  useEffect(() => {
    const meta = document.createElement('meta')
    meta.name = 'robots'
    meta.content = 'noindex'
    document.head.appendChild(meta)
    const previousTitle = document.title
    document.title = title
    return () => {
      meta.remove()
      document.title = previousTitle
    }
  }, [title])
}

const LINKS = [
  { label: 'Home', to: '/' },
  { label: 'Docs', to: '/docs' },
  { label: 'Changelog', to: '/changelog' },
]

export default function NotFound() {
  const { pathname } = useLocation()
  useNoIndex('Page not found · Squash')

  return (
    <MarketingLayout>
      <section aria-labelledby="not-found-heading" className="cabinet-light relative isolate">
        <div
          aria-hidden="true"
          className="mk-ruled pointer-events-none absolute inset-0 -z-10 opacity-40"
        />
        <div className={cn(MK_CONTAINER, 'py-20 sm:py-28 lg:py-40')}>
          <SpecimenLabel
            boxed
            as="div"
            segments={[
              'No. 404',
              'Not found',
              <span className="whitespace-normal break-all normal-case">{pathname}</span>,
            ]}
          />
          <h1
            id="not-found-heading"
            className="mt-8 max-w-[18ch] text-[2.5rem]/[2.75rem] font-semibold tracking-[-0.03em] text-balance sm:text-display-m lg:text-display-l"
          >
            This page escaped.
          </h1>
          <p className="mt-4 max-w-[56ch] text-read text-pretty text-ink-2">
            It may have been moved or squashed. Check the address, or start from one of these.
          </p>
          <nav aria-label="Where to go next" className="mt-10 max-w-md">
            <ul className="border-b border-line">
              {LINKS.map((link) => (
                <li key={link.to} className="border-t border-line">
                  <Link
                    to={link.to}
                    className="t focus-ring-inset group flex h-12 items-center justify-between text-base font-medium hover:text-accent"
                  >
                    {link.label}
                    <ArrowRight
                      size={16}
                      aria-hidden="true"
                      className="t text-ink-3 group-hover:translate-x-0.5 group-hover:text-accent"
                    />
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </section>
    </MarketingLayout>
  )
}
