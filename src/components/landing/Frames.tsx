import type { CSSProperties, ReactNode } from 'react'
import type { ResolvedTheme } from '../../lib/theme'
import { cn } from '../../lib/utils'
import { shotSrc, type Marker, type Shot } from './content'

/** A product screenshot with its intrinsic size set, so layout never jumps or collapses. */
export function ShotImage({
  shot,
  theme,
  lazy = true,
  className,
  style,
}: {
  shot: Shot
  theme: ResolvedTheme
  lazy?: boolean
  className?: string
  style?: CSSProperties
}) {
  return (
    <img
      src={shotSrc(shot, theme)}
      alt={shot.alt}
      width={shot.width}
      height={shot.height}
      loading={lazy ? 'lazy' : 'eager'}
      fetchPriority={lazy ? undefined : 'high'}
      decoding="async"
      style={{ aspectRatio: `${shot.width} / ${shot.height}`, ...style }}
      className={cn('block h-auto w-full', className)}
    />
  )
}

/**
 * Specimen drawer frame: the screenshot laid on paper, with a 1px inner highlight and the layered
 * elev-3 shadow (DESIGN.md section 8).
 */
export function DrawerFrame({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-xl border border-line-2 bg-surface-2 shadow-elev-3',
        "after:pointer-events-none after:absolute after:inset-0 after:rounded-[inherit] after:shadow-[inset_0_1px_0_rgb(255_255_255/0.5)] after:content-[''] dark:after:shadow-[inset_0_1px_0_rgb(255_255_255/0.06)]",
        className,
      )}
    >
      {children}
    </div>
  )
}

/**
 * A marker stroke over a screenshot, drawn in the screenshot's pixel space. The stroke draws itself
 * (stroke-dashoffset) when an ancestor `[data-reveal]` is shown.
 */
export function MarkerStroke({ shot, marker }: { shot: Shot; marker: Marker }) {
  return (
    <svg
      viewBox={`0 0 ${shot.width} ${shot.height}`}
      preserveAspectRatio="none"
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 size-full"
    >
      <path
        d={marker.d}
        pathLength={1}
        fill="none"
        stroke="var(--markup)"
        // Scales with the screenshot: about 3px when it is shown 700px wide.
        strokeWidth={shot.width / 230}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="mk-stroke"
      />
    </svg>
  )
}
