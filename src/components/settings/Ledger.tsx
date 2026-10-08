import type { ReactNode } from 'react'
import { Check } from 'lucide-react'
import { cn } from '../../lib/utils'
import type { SaveState } from './useAutosave'

/** 44px minimum hit area on small (touch) widths; layered on top of the ui Button heights. */
export const TOUCH = 'max-sm:min-h-[3.1429rem]'

/** Filled danger action: only used inside a confirm dialog (outlined everywhere else). */
export const dangerFillClass =
  't focus-ring inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-md border border-transparent bg-danger px-3.5 text-sm font-medium whitespace-nowrap text-bg hover:opacity-90 disabled:pointer-events-none disabled:bg-surface-3 disabled:text-ink-3 pointer-coarse:h-[3.1429rem]'

/** Destructive action in a list row: ghost until hovered, in the danger ink so it reads as one. */
export const dangerGhostClass =
  't focus-ring inline-flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-md border border-transparent px-2.5 text-sm font-medium whitespace-nowrap text-danger select-none hover:border-danger/45 hover:bg-danger/8 disabled:pointer-events-none disabled:text-ink-3 max-sm:min-h-[3.1429rem] pointer-coarse:min-h-[3.1429rem]'

/** Confirm-dialog chrome shared by the danger zone dialogs. */
export const confirmDialogClass =
  'm-auto max-h-[85vh] w-[calc(100%-2rem)] max-w-md animate-dialog overflow-y-auto rounded-xl border border-line bg-surface-2 p-6 text-ink shadow-elev-3 backdrop:bg-scrim'

/**
 * One settings section: a page-level heading and description, then a ledger of rows separated
 * by hairlines. No cards: the section is set straight on the page like a spec sheet.
 */
export function SettingsPanel({
  id,
  title,
  description,
  children,
}: {
  id: string
  title: string
  description?: ReactNode
  children: ReactNode
}) {
  return (
    <section aria-labelledby={`${id}-title`} className="animate-in">
      <header className="pb-8">
        <h2 id={`${id}-title`} className="text-2xl font-semibold text-balance text-ink">
          {title}
        </h2>
        {description && (
          <p className="mt-2 max-w-[56ch] text-sm text-pretty text-ink-2">{description}</p>
        )}
      </header>
      <div className="space-y-12">{children}</div>
    </section>
  )
}

/** A titled group of ledger rows inside a section, headed by a mono eyebrow. An `action` sits at
 * the end of the eyebrow row, and the row is ruled off from the section header above it. */
export function LedgerGroup({
  title,
  meta,
  action,
  children,
  className,
}: {
  title?: string
  meta?: ReactNode
  action?: ReactNode
  children: ReactNode
  className?: string
}) {
  const heading = title && (
    <h3 className="specimen-label flex items-baseline gap-2 text-ink-3">
      {title}
      {meta !== undefined && <span className="text-ink-3">· {meta}</span>}
    </h3>
  )
  return (
    <div className={className}>
      {action ? (
        <div className="flex items-center justify-between gap-4 border-t border-line py-3">
          {heading}
          {action}
        </div>
      ) : (
        heading && <div className="pb-3">{heading}</div>
      )}
      <div className="border-t border-line">{children}</div>
    </div>
  )
}

/**
 * A ledger row: label and description on the left, the control on the right. `stack` puts a
 * wide control (a picker, a list) under the label instead.
 */
export function LedgerRow({
  label,
  description,
  htmlFor,
  labelId,
  stack = false,
  status,
  children,
  className,
}: {
  label: ReactNode
  description?: ReactNode
  /** Id of the control the label names (renders a <label>). */
  htmlFor?: string
  /** Id for the label text, so a group control can use aria-labelledby. */
  labelId?: string
  stack?: boolean
  /** Inline save state next to the label (see SaveIndicator). */
  status?: ReactNode
  children?: ReactNode
  className?: string
}) {
  const labelClass = 'block text-base font-medium text-ink'
  return (
    <div
      className={cn(
        'grid gap-3 border-b border-line py-5',
        !stack && 'sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:gap-8',
        className,
      )}
    >
      <div className="min-w-0">
        <div className="flex flex-wrap items-baseline gap-x-3">
          {htmlFor ? (
            <label id={labelId} htmlFor={htmlFor} className={labelClass}>
              {label}
            </label>
          ) : (
            <p id={labelId} className={labelClass}>
              {label}
            </p>
          )}
          {status}
        </div>
        {description && (
          <div className="mt-1 max-w-[52ch] text-sm text-pretty text-ink-2">{description}</div>
        )}
      </div>
      {children !== undefined && (
        <div
          className={cn(
            'flex min-w-0 flex-wrap items-center gap-2',
            !stack && 'sm:flex-nowrap sm:justify-end',
          )}
        >
          {children}
        </div>
      )}
    </div>
  )
}

/**
 * The inline autosave tick beside a row label: "Saving…", then "Saved" for a moment. The live
 * region is always mounted so screen readers hear each change; errors render as an alert under
 * the control instead (see SaveError).
 */
export function SaveIndicator({ state }: { state: SaveState }) {
  return (
    <span role="status" className="inline-flex min-h-5 items-center gap-1 text-sm text-ink-3">
      {state.status === 'saving' && 'Saving…'}
      {state.status === 'saved' && (
        <span className="inline-flex animate-in items-center gap-1 text-success">
          <Check className="size-3.5" strokeWidth={2} absoluteStrokeWidth aria-hidden />
          Saved
        </span>
      )}
    </span>
  )
}

/** A save or validation error for one field, tied to its control by `id`. */
export function SaveError({ id, state }: { id: string; state: SaveState }) {
  if (state.status !== 'error') return null
  return (
    <p id={id} role="alert" className="w-full text-sm text-danger sm:text-right">
      {state.message}
    </p>
  )
}

/** Static placeholder blocks shaped like ledger rows (no spinner). */
export function LedgerSkeleton({ rows = 3, label }: { rows?: number; label: string }) {
  return (
    <div role="status" aria-label={label}>
      <span className="sr-only">{label}</span>
      <div aria-hidden="true" className="space-y-3 pb-8">
        <div className="h-7 w-40 animate-skeleton rounded-sm bg-surface-3" />
        <div className="h-4 w-72 max-w-full animate-skeleton rounded-sm bg-surface-3" />
      </div>
      <div aria-hidden="true" className="border-t border-line">
        {Array.from({ length: rows }, (_, index) => (
          <div
            key={index}
            className="flex items-center justify-between gap-8 border-b border-line py-5"
          >
            <div className="min-w-0 flex-1 space-y-2">
              <div className="h-4 w-32 animate-skeleton rounded-sm bg-surface-3" />
              <div className="h-3.5 w-3/5 animate-skeleton rounded-sm bg-surface-3" />
            </div>
            <div className="h-8 w-24 animate-skeleton rounded-md bg-surface-3" />
          </div>
        ))}
      </div>
    </div>
  )
}
