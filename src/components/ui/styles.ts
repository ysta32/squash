import { cn } from '../../lib/utils'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'
export type ButtonSize = 'sm' | 'md' | 'lg'

// Disabled states are neutral (no opacity wash) so they read as "unavailable", not "faded accent".
const VARIANT: Record<ButtonVariant, string> = {
  primary:
    'border border-transparent bg-accent text-accent-fg shadow-xs hover:bg-accent-hover disabled:border-border disabled:bg-bg-subtle disabled:text-muted disabled:shadow-none',
  secondary:
    'border border-border bg-bg text-fg shadow-xs hover:bg-bg-subtle disabled:text-muted disabled:shadow-none',
  ghost: 'text-muted hover:bg-bg-subtle hover:text-fg disabled:text-muted/70',
  danger:
    'border border-danger/40 text-danger hover:bg-danger/10 disabled:border-border disabled:text-muted',
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
    't focus-ring inline-flex shrink-0 items-center justify-center font-medium whitespace-nowrap active:translate-y-px disabled:pointer-events-none disabled:cursor-default',
    VARIANT[variant],
    SIZE[size],
    className,
  )
}

export const inputClass =
  't focus-ring h-9 w-full rounded-md border border-border bg-bg px-3 text-sm text-fg placeholder:text-muted hover:border-fg/20 disabled:cursor-not-allowed disabled:bg-bg-subtle disabled:text-muted'

/** Inline link inside running text: a persistent underline so it is not told apart by color alone. */
export const proseLinkClass =
  'focus-ring rounded-md text-accent underline decoration-accent/40 underline-offset-2 hover:decoration-accent'

/** Popover / menu / dropdown surface. Same look as the `.panel` utility in index.css. */
export const panelClass = 'rounded-lg border border-border bg-bg-elevated shadow-elevated'

/** A row inside a panelClass menu. Pair with aria-selected / data-active for the highlighted row. */
export const menuItemClass =
  't flex h-8 w-full cursor-default items-center gap-2 rounded-md px-2 text-left text-sm text-fg outline-none select-none hover:bg-bg-subtle focus-visible:bg-bg-subtle aria-selected:bg-bg-subtle data-[active=true]:bg-bg-subtle disabled:text-muted [&>svg]:size-4 [&>svg]:shrink-0 [&>svg]:text-muted'

/** Dialog chrome shared by modal sheets: the dimmed overlay and the centred panel. */
export const dialogOverlayClass = 'fixed inset-0 z-50 bg-black/40 backdrop-blur-[2px] animate-fade'
export const dialogPanelClass =
  'relative w-full rounded-xl border border-border bg-bg-elevated shadow-elevated animate-in'
