import type { ReactNode } from 'react'
import { cn } from '../../lib/utils'

/** Mono uppercase eyebrow, then a display heading and an optional paragraph (56ch measure). */
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

/** Hairline-separated page band with the marketing section rhythm (96px desktop, 64px phone). */
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
      className={cn('scroll-mt-16 border-t border-line py-16 lg:py-28', className)}
    >
      {children}
    </section>
  )
}
