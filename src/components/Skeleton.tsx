import { cn } from '../lib/utils'

const TITLE_WIDTHS = ['62%', '44%', '55%', '68%', '40%', '50%']

/** Row geometry shared with BugRow: 36px desktop, 48px on touch, a hairline under each row. */
export const ROW_BOX =
  'flex h-[2.5714rem] items-center gap-3 border-b border-line pr-3 pl-4 pointer-coarse:h-[3.4286rem]'

const BLOCK = 'rounded-xs bg-surface-3'

/**
 * Loading rows that match BugRow exactly (DESIGN.md "States: Loading"): check-off circle, severity ticks, number,
 * a title bar at 40–70% width, time and avatar. Static blocks with a slow opacity pulse; no
 * shimmer and no spinner.
 */
export function Skeleton({ rows = TITLE_WIDTHS.length }: { rows?: number }) {
  return (
    <div role="status" aria-label="Loading bugs">
      <span className="sr-only">Loading bugs…</span>
      {Array.from({ length: rows }, (_, index) => (
        <div
          key={index}
          aria-hidden="true"
          className={cn(ROW_BOX, 'animate-skeleton')}
          style={{ animationDelay: `${index * 90}ms` }}
        >
          <span className="size-[16px] shrink-0 rounded-full border border-line-input" />
          <span className="flex size-[16px] shrink-0 items-center justify-center gap-[2px]">
            {[0, 1, 2, 3].map((tick) => (
              <span key={tick} className={cn('h-[8px] w-[2px]', BLOCK)} />
            ))}
          </span>
          <span className="flex w-[4ch] shrink-0 justify-end font-mono text-xs">
            <span className={cn('h-2.5 w-[3ch]', BLOCK)} />
          </span>
          <span className="min-w-0 flex-1">
            <span
              className={cn('block h-2.5', BLOCK)}
              style={{ width: TITLE_WIDTHS[index % TITLE_WIDTHS.length] }}
            />
          </span>
          <span className={cn('h-2.5 w-[3ch] font-mono text-xs', BLOCK)} />
          <span className="size-[20px] shrink-0 rounded-full bg-surface-3" />
        </div>
      ))}
    </div>
  )
}
