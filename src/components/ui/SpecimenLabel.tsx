import { Fragment } from 'react'
import type { ReactNode } from 'react'
import { cn } from '../../lib/utils'
import { labelClass } from './styles'

/** One field of a specimen label. Falsy entries are skipped, so callers can inline conditions. */
export type SpecimenSegment = ReactNode

function present(segments: readonly SpecimenSegment[]): SpecimenSegment[] {
  return segments.filter((s) => s !== null && s !== undefined && s !== false && s !== '')
}

function Line({ segments, className }: { segments: SpecimenSegment[]; className?: string }) {
  return (
    <span className={cn('block', className)}>
      {segments.map((segment, i) => (
        <Fragment key={i}>
          {/* Each field carries its trailing dot as one atomic unit: lines break between units
              (never before a dot), and a field wider than the column wraps inside itself
              instead of overflowing. */}
          <span className="inline-block max-w-full [overflow-wrap:anywhere]">
            {segment}
            {i < segments.length - 1 && (
              <>
                <span aria-hidden="true" className="px-[0.6ch] text-ink-3">
                  ·
                </span>
                <span className="sr-only">, </span>
              </>
            )}
          </span>
        </Fragment>
      ))}
    </span>
  )
}

export interface SpecimenLabelProps {
  /** First line: `NO. 024 · BUG · CRITICAL`. */
  segments: readonly SpecimenSegment[]
  /** Optional second line (collector, date, context), set under a hairline when boxed. */
  detail?: readonly SpecimenSegment[]
  /** Draw the bordered specimen-label block (bug header, Fix record, press cards). */
  boxed?: boolean
  as?: 'p' | 'div'
  className?: string
}

/**
 * The specimen label motif (DESIGN.md section 3): mono uppercase fields joined by ` · `, with
 * tabular numerals. Screen readers hear the fields separated by commas instead of "dot".
 */
export function SpecimenLabel({
  segments,
  detail,
  boxed = false,
  as: Tag = 'p',
  className,
}: SpecimenLabelProps) {
  const top = present(segments)
  const bottom = detail ? present(detail) : []
  return (
    <Tag
      className={cn(
        labelClass,
        'text-ink-2',
        boxed
          ? 'inline-block max-w-full rounded-xs border border-line-2 bg-surface-1 px-2 py-1'
          : 'block',
        className,
      )}
    >
      <Line segments={top} />
      {bottom.length > 0 && (
        <Line
          segments={bottom}
          className={cn(
            'text-ink-3',
            boxed ? '-mx-2 mt-1 border-t border-line px-2 pt-1' : 'mt-0.5',
          )}
        />
      )}
    </Tag>
  )
}
