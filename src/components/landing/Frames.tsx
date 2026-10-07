import type { CSSProperties, ReactNode } from 'react'
import type { ResolvedTheme } from '../../lib/theme'
import { cn } from '../../lib/utils'
import { shotSrc, type Shot } from './content'

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

/** Window-like frame: a hairline outer ring with a small inset around the screenshot. */
export function ShotFrame({
  children,
  className,
  plain = false,
}: {
  children: ReactNode
  className?: string
  /** Just a hairline border and soft shadow, for screenshots that already sit on a Stage. */
  plain?: boolean
}) {
  if (plain) {
    return (
      <div
        className={cn(
          'overflow-hidden rounded-lg border border-border bg-bg-elevated',
          'shadow-[0_1px_2px_rgb(0_0_0/0.04),0_16px_32px_-12px_rgb(0_0_0/0.14)]',
          'dark:shadow-[0_1px_2px_rgb(0_0_0/0.4),0_16px_32px_-12px_rgb(0_0_0/0.6)]',
          className,
        )}
      >
        {children}
      </div>
    )
  }
  return (
    <div
      className={cn(
        'rounded-xl border border-border bg-bg-subtle p-1 sm:rounded-2xl sm:p-1.5',
        'shadow-[0_1px_2px_rgb(0_0_0/0.04),0_12px_24px_-12px_rgb(0_0_0/0.12),0_40px_80px_-24px_rgb(0_0_0/0.16)]',
        'dark:shadow-[0_1px_2px_rgb(0_0_0/0.4),0_12px_24px_-12px_rgb(0_0_0/0.5),0_40px_80px_-24px_rgb(0_0_0/0.6)]',
        className,
      )}
    >
      <div className="overflow-hidden rounded-lg border border-border bg-bg-elevated sm:rounded-xl">
        {children}
      </div>
    </div>
  )
}

/** Square-cornered panel that every feature image sits on, so mixed aspect ratios line up. */
export function Stage({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-2xl border border-border bg-bg-subtle',
        className,
      )}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(var(--border)_1px,transparent_1px)] [mask-image:radial-gradient(ellipse_at_center,black_30%,transparent_80%)] bg-[size:16px_16px] opacity-70"
      />
      <div className="relative">{children}</div>
    </div>
  )
}

const MOBILE = { src: '/product/mobile.webp', width: 1400, height: 981 }

export interface PhoneCrop {
  /** Left, top, width and height of one phone screen inside mobile.webp, in image pixels. */
  x: number
  y: number
  w: number
  h: number
  alt: string
}

/**
 * Shows one phone from the three-phone mobile.webp composite inside a device bezel.
 * The crop is percentage based, so it scales with the frame and keeps the right aspect ratio.
 */
export function PhoneFrame({ crop, className }: { crop: PhoneCrop; className?: string }) {
  return (
    <div
      className={cn(
        'rounded-[1.75rem] bg-zinc-900 p-[5px] ring-1 ring-black/5 dark:bg-zinc-950 dark:ring-white/10',
        'shadow-[0_2px_4px_rgb(0_0_0/0.06),0_24px_48px_-16px_rgb(0_0_0/0.28)]',
        className,
      )}
    >
      <div
        className="relative overflow-hidden rounded-[1.4rem] bg-bg"
        style={{ aspectRatio: `${crop.w} / ${crop.h}` }}
      >
        <img
          src={MOBILE.src}
          alt={crop.alt}
          width={MOBILE.width}
          height={MOBILE.height}
          loading="lazy"
          decoding="async"
          className="absolute h-auto max-w-none"
          style={{
            width: `${(MOBILE.width / crop.w) * 100}%`,
            left: `${(-crop.x / crop.w) * 100}%`,
            top: `${(-crop.y / crop.h) * 100}%`,
          }}
        />
      </div>
    </div>
  )
}
