import { pinChecklist, parseAnnotations } from '../lib/annotations'
import { cn } from '../lib/utils'

interface AnnotationChecklistProps {
  /** A screenshot's stored `annotations` (raw jsonb); malformed values render nothing. */
  annotations: unknown
  /** Pin numbers already done; their lines render struck through. */
  done?: ReadonlySet<number>
  className?: string
}

/**
 * One checklist line per numbered pin ("① Banner overlaps Pay now"), its numeral circled in
 * Plex Mono 500 and the accent like the pins on the screenshot overlay. Nothing when no pins.
 */
export function AnnotationChecklist({ annotations, done, className }: AnnotationChecklistProps) {
  const items = pinChecklist(parseAnnotations(annotations))
  if (items.length === 0) return null
  return (
    <ol aria-label="Pinned issues" className={cn('flex flex-col gap-2 text-sm', className)}>
      {items.map((item) => {
        const checked = done?.has(item.n) ?? false
        return (
          <li key={item.n} className="flex items-start gap-2">
            <span
              aria-hidden="true"
              className={cn(
                'mt-px inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full border border-current px-1 font-mono text-[11px] font-medium text-accent',
              )}
            >
              {item.n}
            </span>
            <span
              className={cn(
                'min-w-0 break-words',
                checked ? 'text-ink-3 line-through' : 'text-ink',
              )}
            >
              <span className="sr-only">
                Pin {item.n}
                {checked ? ', done' : ''}:{' '}
              </span>
              {item.note ?? <span className="text-ink-3">No note</span>}
            </span>
          </li>
        )
      })}
    </ol>
  )
}
