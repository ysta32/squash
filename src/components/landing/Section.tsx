import type { ReactNode } from 'react'
import { cn } from '../../lib/utils'

/** A band's heading: a section marker, display type, then the paragraph on a short measure. */
export function EntryHead({
  id,
  mark,
  title,
  children,
  className,
}: {
  id: string
  /** The section's name, hung above the heading after a marker slash. */
  mark?: string
  title: ReactNode
  children?: ReactNode
  className?: string
}) {
  return (
    <div className={className}>
      {mark && <p className="lp-mark mb-4">{mark}</p>}
      <h2 id={id} className="lp-display lp-h2">
        {title}
      </h2>
      {children && <div className="lp-read mt-5">{children}</div>}
    </div>
  )
}

/**
 * Mono eyebrow, display heading and an optional paragraph: the heading block the other marketing
 * pages use. The home page uses `EntryHead` instead, which carries no eyebrow.
 */
export function SectionHead({
  id,
  eyebrow,
  title,
  children,
  className,
}: {
  id: string
  eyebrow: string
  title: ReactNode
  children?: ReactNode
  className?: string
}) {
  return (
    <div className={className}>
      <p className="specimen-label text-ink-3">{eyebrow}</p>
      <h2
        id={id}
        className="mt-3 text-[2rem]/[2.4rem] font-semibold tracking-[-0.025em] text-balance sm:text-display-s"
      >
        {title}
      </h2>
      {children && (
        <div className="mt-4 max-w-[56ch] text-read text-pretty text-ink-2">{children}</div>
      )}
    </div>
  )
}

/** A section after the record closes: the same rhythm, without a time on the rail. */
export function Band({
  children,
  className,
  labelledBy,
  id,
}: {
  children: ReactNode
  className?: string
  labelledBy: string
  id?: string
}) {
  return (
    <section
      id={id}
      aria-labelledby={labelledBy}
      className={cn('scroll-mt-20 border-t border-line py-20 lg:py-28', className)}
    >
      {children}
    </section>
  )
}
