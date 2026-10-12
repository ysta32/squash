import { useId } from 'react'
import { cn } from '../../lib/utils'
import { APP_ICON_GRID, PIN_GRID, PIN_HEAD, PIN_NEEDLE, PIN_STROKE, appIconShapes } from './pinMark'

/**
 * The app icon (same artwork as public/favicon.svg and the PWA icons): the pin on a viridian
 * squircle. Fixed colors, so it looks the same on paper and in the darkroom.
 */
export function AppIcon({ size = 16, className }: { size?: number; className?: string }) {
  // Gradient ids must be unique per page; useId's punctuation is not safe inside url(#…).
  const id = `app-icon-${useId().replace(/[^\w-]/g, '')}`
  return (
    <svg
      viewBox={`0 0 ${APP_ICON_GRID} ${APP_ICON_GRID}`}
      width={size}
      height={size}
      aria-hidden="true"
      focusable="false"
      className={cn('shrink-0', className)}
      // Static markup from pinMark.ts, never user input.
      dangerouslySetInnerHTML={{ __html: appIconShapes(id) }}
    />
  )
}

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

/** App icon plus the lowercase "squash" wordmark (Plex Sans 600, -0.02em). */
export function Logo({ size = 18, className }: { size?: number; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 leading-none font-semibold tracking-[-0.02em] text-ink',
        className,
      )}
    >
      <AppIcon size={size} />
      <span>squash</span>
    </span>
  )
}
