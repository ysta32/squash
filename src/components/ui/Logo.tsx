import { useId } from 'react'
import { cn } from '../../lib/utils'
import { APP_ICON_GRID, MARK_GRID, appIconShapes, markShapes } from './mark'

/**
 * The app icon (same artwork as public/favicon.svg and the PWA icons): the beetle on a viridian
 * squircle. Fixed colors, so it looks the same on paper and in the darkroom.
 */
export function AppIcon({ size = 16, className }: { size?: number; className?: string }) {
  // Mask ids must be unique per page; useId's punctuation is not safe inside url(#…).
  const id = `app-icon-${useId().replace(/[^\w-]/g, '')}`
  return (
    <svg
      viewBox={`0 0 ${APP_ICON_GRID} ${APP_ICON_GRID}`}
      width={size}
      height={size}
      aria-hidden="true"
      focusable="false"
      className={cn('shrink-0', className)}
      // Static markup from mark.ts, never user input.
      dangerouslySetInnerHTML={{ __html: appIconShapes(id) }}
    />
  )
}

/**
 * The beetle mark on its own (same artwork as the app icon, without the tile) in the current
 * accent, so it reads on paper and in the darkroom alike.
 */
export function LogoMark({ size = 16, className }: { size?: number; className?: string }) {
  const id = `logo-mark-${useId().replace(/[^\w-]/g, '')}`
  return (
    <svg
      viewBox={`0 0 ${MARK_GRID} ${MARK_GRID}`}
      width={size}
      height={size}
      aria-hidden="true"
      focusable="false"
      className={cn('shrink-0', className)}
      // Static markup from mark.ts, never user input.
      dangerouslySetInnerHTML={{ __html: markShapes('var(--accent)', id) }}
    />
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
