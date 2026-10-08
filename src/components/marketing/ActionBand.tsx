import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { cn } from '../../lib/utils'
import { buttonClass } from '../ui'
import { MK_CONTAINER, OpenWorkspaceLink } from './MarketingLayout'
import { Reveal } from './Reveal'

/** The closing "action" band of a marketing page: one line, one primary, one secondary. */
export function ActionBand({
  title,
  children,
  secondary = { label: 'Self-host it', to: '/docs/self-host' },
  id = 'action-heading',
}: {
  title: ReactNode
  children?: ReactNode
  secondary?: { label: string; to: string } | null
  id?: string
}) {
  return (
    <section aria-labelledby={id} className="cabinet-light border-t border-line">
      <div className={cn(MK_CONTAINER, 'py-20 lg:py-28')}>
        <Reveal>
          <p className="specimen-label text-ink-3">Start</p>
          <h2
            id={id}
            className="mt-3 max-w-[20ch] text-[2.25rem]/[2.5rem] font-semibold tracking-[-0.03em] text-balance sm:text-display-m"
          >
            {title}
          </h2>
          {children && (
            <div className="mt-5 max-w-[56ch] text-read text-pretty text-ink-2">{children}</div>
          )}
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <OpenWorkspaceLink size="lg" />
            {secondary && (
              <Link to={secondary.to} className={buttonClass('secondary', 'lg')}>
                {secondary.label}
              </Link>
            )}
          </div>
        </Reveal>
      </div>
    </section>
  )
}

/** A short list of facts with hairline rules between them (the chapter fact lists). */
export function FactList({ facts, className }: { facts: ReactNode[]; className?: string }) {
  return (
    <ul className={cn('border-b border-line', className)}>
      {facts.map((fact, i) => (
        <li key={i} className="border-t border-line py-2.5 text-sm text-pretty text-ink-2">
          {fact}
        </li>
      ))}
    </ul>
  )
}

/** Inline arrow link used under sections ("Read the docs →"). */
export const arrowLinkClass =
  't focus-ring inline-flex min-h-11 items-center gap-2 rounded-md text-sm font-medium text-accent hover:text-accent-strong'
