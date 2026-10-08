import { cn } from '../../lib/utils'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'destructive'
export type ButtonSize = 'sm' | 'md' | 'lg' | 'touch'

// Specimen buttons (DESIGN.md sections 3 and 5). Primary is the accent fill and the only filled
// button on a screen; secondary is a hairline outline; danger is outlined until a confirm dialog,
// where `destructive` (the --danger fill) is the dialog's confirm button.
// A disabled primary is the enabled button at 60% opacity (fill and label together, so the label
// keeps its contrast against the fill): the screen's one primary action still reads as the focal
// point while it waits for valid input (a grey primary reads as a secondary button). Other
// variants go neutral.
const VARIANT: Record<ButtonVariant, string> = {
  primary:
    'border border-transparent bg-accent text-accent-fg shadow-elev-1 hover:bg-accent-strong disabled:opacity-60 disabled:shadow-none aria-disabled:hover:bg-accent',
  secondary:
    'border border-line-2 bg-transparent text-ink hover:border-line-input hover:bg-surface-3 disabled:border-line disabled:bg-transparent disabled:text-ink-3',
  ghost:
    'border border-transparent text-ink-2 hover:bg-surface-3 hover:text-ink disabled:bg-transparent disabled:text-ink-3',
  danger:
    'border border-danger/45 bg-transparent text-danger hover:border-danger hover:bg-danger/8 disabled:border-line disabled:text-ink-3',
  destructive:
    'border border-transparent bg-danger text-on-danger shadow-elev-1 hover:opacity-90 disabled:opacity-60 disabled:shadow-none',
}

// Heights: sm 28px, md 31.5px, lg 40px (Tailwind's 0.25rem step is 3.5px at the 14px root).
// md and lg grow to 44px on touch screens; `touch` is 44px everywhere (mobile toolbars, sheets).
const SIZE: Record<ButtonSize, string> = {
  sm: 'h-8 gap-1.5 rounded-md px-2.5 text-sm',
  md: 'h-9 gap-2 rounded-md px-3.5 text-sm pointer-coarse:h-[3.1429rem]',
  lg: 'h-11.5 gap-2 rounded-md px-4.5 text-base pointer-coarse:h-[3.1429rem]',
  touch: 'h-[3.1429rem] gap-2 rounded-md px-4.5 text-base',
}

/** Class names for a button-styled element; use when the element is not a <button> or <Link>. */
export function buttonClass(
  variant: ButtonVariant = 'secondary',
  size: ButtonSize = 'md',
  className?: string,
): string {
  return cn(
    't focus-ring inline-flex shrink-0 items-center justify-center font-medium whitespace-nowrap select-none active:translate-y-px disabled:pointer-events-none aria-busy:cursor-progress [&_svg]:shrink-0',
    VARIANT[variant],
    SIZE[size],
    className,
  )
}

/** Text inputs: a 3:1 input border, a focus ring plus a border change to the focus color. */
export const inputClass =
  't focus-ring h-9 w-full rounded-md border border-line-input bg-surface-2 px-3 text-base text-ink placeholder:text-ink-3 hover:border-ink-3 focus-visible:border-focus aria-invalid:border-danger disabled:cursor-not-allowed disabled:border-line-2 disabled:bg-surface-3 disabled:text-ink-3 pointer-coarse:h-[3.1429rem] pointer-coarse:text-[1.1429rem]'

/** Mono uppercase eyebrow / specimen-label type (DESIGN.md `label` token). */
export const labelClass =
  'font-mono text-label font-normal tracking-[0.06em] uppercase tabular-nums'

/** Inline link inside running text: a persistent underline so it is not told apart by color alone. */
export const proseLinkClass =
  'focus-ring rounded-xs text-accent underline decoration-accent/40 underline-offset-2 hover:decoration-accent'

/** Popover / menu / dropdown surface. Same look as the `.panel` utility in index.css. */
export const panelClass = 'rounded-lg border border-line bg-surface-2 shadow-elev-2'

/**
 * A row inside a panelClass menu: 32px, 44px on touch screens (DESIGN.md). Pair with aria-selected
 * / data-active for the highlighted row.
 */
export const menuItemClass =
  't flex h-8 w-full pointer-coarse:h-[3.1429rem] cursor-default items-center gap-2 rounded-md px-2 text-left text-sm text-ink outline-none select-none hover:bg-surface-3 focus-visible:bg-surface-3 aria-selected:bg-surface-3 data-[active=true]:bg-surface-3 disabled:text-ink-3 [&>svg]:size-4 [&>svg]:shrink-0 [&>svg]:text-ink-3'

/** Dialog chrome shared by modal sheets: the blurred scrim and the panel (DESIGN.md section 5). */
export const dialogOverlayClass = 'fixed inset-0 z-50 glass-scrim animate-fade'
export const dialogPanelClass =
  'relative w-full rounded-xl border border-line bg-surface-2 shadow-elev-3 animate-dialog'
