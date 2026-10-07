import { cn } from '../../lib/utils'

/** The Squash mark (same artwork as public/favicon.svg), drawn in the current accent color. */
export function LogoMark({ size = 24, className }: { size?: number; className?: string }) {
  return (
    <svg
      viewBox="0 0 64 64"
      width={size}
      height={size}
      aria-hidden="true"
      className={cn('shrink-0', className)}
    >
      <rect width="64" height="64" rx="14" fill="var(--accent)" />
      <path
        d="M42 22.5c-1.9-3-5.6-4.5-9.8-4.5-5.6 0-9.7 2.9-9.7 7.3 0 4.2 3.3 6 8.9 7.1 5 1 7 2 7 4.4 0 2.5-2.6 4.2-6.4 4.2-3.7 0-6.6-1.5-8.3-4.3"
        fill="none"
        stroke="var(--accent-fg)"
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

/** Mark plus wordmark. */
export function Logo({ size = 22, className }: { size?: number; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-2 font-semibold tracking-tight', className)}>
      <LogoMark size={size} />
      Squash
    </span>
  )
}
