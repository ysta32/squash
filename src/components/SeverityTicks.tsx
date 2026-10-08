import { SEVERITIES, SEVERITY_LABEL } from '../lib/types'
import type { Severity } from '../lib/types'
import { cn } from '../lib/utils'

const TICK_COLOR: Record<Severity, string> = {
  low: 'bg-sev-low',
  medium: 'bg-sev-medium',
  high: 'bg-sev-high',
  critical: 'bg-sev-critical',
}

/**
 * Severity as a field-notebook tally (DESIGN.md "Palette"): 1–4 ticks, 2px wide, 8px tall, 2px
 * apart, left-aligned in a fixed 16px box so titles stay in a column. Only the reached ticks are
 * drawn (no faint placeholders that would blur low into empty). Never colour alone: the word is
 * the accessible name and the tooltip.
 */
export function SeverityTicks({ severity, className }: { severity: Severity; className?: string }) {
  const level = SEVERITIES.indexOf(severity) + 1
  const label = `${SEVERITY_LABEL[severity]} severity`
  return (
    <span
      role="img"
      aria-label={label}
      title={label}
      data-severity={severity}
      className={cn('inline-flex size-[16px] shrink-0 items-center gap-[2px]', className)}
    >
      {SEVERITIES.slice(0, level).map((tick) => (
        <span
          key={tick}
          aria-hidden="true"
          className={cn('h-[8px] w-[2px] rounded-xs', TICK_COLOR[severity])}
        />
      ))}
    </span>
  )
}
