import type { CSSProperties, ReactNode } from 'react'
import { useInView } from './useInView'

/** Fades and lifts its content in when scrolled into view; `delay` staggers siblings (ms). */
export function Reveal({
  children,
  delay = 0,
  className,
}: {
  children: ReactNode
  delay?: number
  className?: string
}) {
  const [ref, shown] = useInView<HTMLDivElement>()
  return (
    <div
      ref={ref}
      data-reveal={shown ? 'shown' : 'hidden'}
      style={{ '--mk-delay': `${delay}ms` } as CSSProperties}
      className={className}
    >
      {children}
    </div>
  )
}
