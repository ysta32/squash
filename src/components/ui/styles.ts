import { cn } from '../../lib/utils'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'
export type ButtonSize = 'sm' | 'md' | 'lg'

const VARIANT: Record<ButtonVariant, string> = {
  primary: 'bg-accent text-accent-fg hover:opacity-90',
  secondary: 'border border-border bg-bg text-fg hover:bg-bg-subtle',
  ghost: 'text-muted hover:bg-bg-subtle hover:text-fg',
  danger: 'border border-danger/40 text-danger hover:bg-danger/10',
}

const SIZE: Record<ButtonSize, string> = {
  sm: 'h-7 gap-1.5 rounded-md px-2.5 text-xs',
  md: 'h-9 gap-2 rounded-md px-3.5 text-sm',
  lg: 'h-11 gap-2 rounded-lg px-5 text-sm',
}

/** Class names for a button-styled element; use when the element is not a <button> or <Link>. */
export function buttonClass(
  variant: ButtonVariant = 'secondary',
  size: ButtonSize = 'md',
  className?: string,
): string {
  return cn(
    't focus-ring inline-flex shrink-0 items-center justify-center font-medium whitespace-nowrap disabled:pointer-events-none disabled:opacity-50',
    VARIANT[variant],
    SIZE[size],
    className,
  )
}

export const inputClass =
  't focus-ring h-9 w-full rounded-md border border-border bg-bg px-3 text-sm text-fg placeholder:text-muted hover:border-fg/20 disabled:opacity-50'
