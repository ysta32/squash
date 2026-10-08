import { cn } from '../../lib/utils'
import { PIN_GRID, PIN_HEAD, PIN_NEEDLE, PIN_STROKE } from './pinMark'

/**
 * The specimen pin mark (same artwork as public/favicon.svg): a pin head in the current accent
 * and a needle in ink, so it reads on paper and in the darkroom alike.
 */
export function LogoMark({ size = 16, className }: { size?: number; className?: string }) {
  return (
    <svg
      viewBox={`0 0 ${PIN_GRID} ${PIN_GRID}`}
      width={size}
      height={size}
      aria-hidden="true"
      focusable="false"
      className={cn('shrink-0', className)}
    >
      <path
        d={`M${PIN_NEEDLE.x1} ${PIN_NEEDLE.y1} ${PIN_NEEDLE.x2} ${PIN_NEEDLE.y2}`}
        fill="none"
        stroke="var(--text-1)"
        strokeWidth={PIN_STROKE}
        strokeLinecap="round"
      />
      <circle cx={PIN_HEAD.cx} cy={PIN_HEAD.cy} r={PIN_HEAD.r} fill="var(--accent)" />
    </svg>
  )
}

/** Pin mark plus the lowercase "squash" wordmark (Plex Sans 600, -0.02em). */
export function Logo({ size = 18, className }: { size?: number; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 leading-none font-semibold tracking-[-0.02em] text-ink',
        className,
      )}
    >
      <LogoMark size={size} />
      <span>squash</span>
    </span>
  )
}
