import type { CSSProperties, ReactNode } from 'react'
import { useInView } from './useInView'

/**
 * Fades and lifts its content in when scrolled into view; `delay` staggers siblings (ms).
 * Visible by default: only content measured as below the fold is hidden until it arrives.
 */
export function Reveal({
  children,
  delay = 0,
  className,
}: {
  children: ReactNode
  delay?: number
  className?: string
}) {
  const [ref, state] = useInView<HTMLDivElement>()
  return (
    <div
      ref={ref}
      data-reveal={state}
      style={{ '--mk-delay': `${delay}ms` } as CSSProperties}
      className={className}
    >
      {children}
    </div>
  )
}
