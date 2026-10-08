import type { CSSProperties } from 'react'
import { cn } from '../../lib/utils'
import { labelClass } from '../ui'

/**
 * The boxed specimen label (same look as ui/SpecimenLabel) whose characters type in one by one:
 * 18 ms each, compressed so a long label still finishes in about 600 ms. Screen readers get the
 * whole line at once; reduced motion shows it immediately (marketing.css).
 */
export function TypedSpecimenLabel({
  lines,
  delay = 0,
  className,
}: {
  lines: string[][]
  /** Typing start, in ms. */
  delay?: number
  className?: string
}) {
  // No-break spaces inside a field and before each dot, so a narrow label wraps only after a dot.
  const text = lines.map((fields) =>
    fields.map((f) => f.replaceAll(' ', '\u00a0')).join('\u00a0· '),
  )
  const total = text.reduce((sum, line) => sum + line.length, 0)
  const step = Math.min(18, 600 / Math.max(1, total))
  let index = 0
  return (
    <div
      style={{ '--mk-step': `${step}ms`, '--mk-delay': `${delay}ms` } as CSSProperties}
      className={cn(
        labelClass,
        'inline-block max-w-full rounded-xs border border-line-2 bg-surface-1 px-2 py-1 text-ink-2',
        className,
      )}
    >
      {text.map((line, i) => (
        <p key={i} className={cn(i > 0 && '-mx-2 mt-1 border-t border-line px-2 pt-1 text-ink-3')}>
          <span className="sr-only">{line}</span>
          <span aria-hidden="true">
            {[...line].map((char) => {
              const style = { '--mk-i': index++ } as CSSProperties
              return (
                <span key={index} className="mk-char" style={style}>
                  {char}
                </span>
              )
            })}
          </span>
        </p>
      ))}
    </div>
  )
}
