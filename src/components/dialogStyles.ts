// Shared chrome for the app's modal dialogs (Invite, Shortcuts, Claude setup) and the palette.
// DESIGN.md §5 "Dialogs": surface-2, radius-xl, elev-3, 24px padding, lg title, opacity plus a
// 4px rise at --dur-emphasis. @starting-style drives the entrance, so it needs no JS and the global
// reduced-motion rule turns it into a short opacity fade.

// Anatomy, the same in every dialog: a mono eyebrow, the title, a close X top right, then the body
// and a right-aligned footer of actions. Focus opens on the first editable field, else the panel
// itself (useFocusTrap's `initialFocus: 'field'`), so no button opens wearing a focus ring.

/** Full-screen scrim: warm wash plus a 4px blur. Click-outside handling stays with each dialog. */
export const scrimClass =
  'fixed inset-0 z-50 dialog-scrim transition-opacity duration-(--dur-emphasis) ease-(--ease-out) starting:opacity-0'

/**
 * Lays a dialog out on the scrim, anchored near the top rather than centred, so a dialog whose
 * content changes height (a confirm step, an expanded section) grows downward instead of jumping.
 */
export const dialogPositionClass =
  'flex items-start justify-center p-3 pt-[10dvh] sm:p-6 sm:pt-[12dvh]'

/** Max height for a top-anchored dialog: the viewport less the top offset and bottom padding. */
export const dialogMaxHeightClass = 'max-h-[calc(90dvh-0.75rem)] sm:max-h-[calc(88dvh-1.5rem)]'

/** A native <dialog> opened with showModal(): same panel, same blurred ::backdrop. */
export const nativeDialogClass =
  'm-auto max-h-[85dvh] w-[calc(100%-2rem)] max-w-md overflow-y-auto rounded-xl border border-line bg-surface-2 p-6 text-ink shadow-elev-3 outline-none backdrop:dialog-scrim animate-dialog'

/** The dialog panel itself; callers add width, padding and layout. */
export const dialogClass =
  'relative w-full rounded-xl border border-line bg-surface-2 text-ink shadow-elev-3 outline-none transition-[opacity,transform] duration-(--dur-emphasis) ease-(--ease-out) starting:translate-y-1 starting:opacity-0'

/** `lg` dialog title. */
export const dialogTitleClass = 'text-lg font-semibold text-ink'

/** Mono uppercase eyebrow, as used for specimen labels and group headings. */
export const eyebrowClass = 'specimen-label'

/** 32px icon-only close button in the dialog's top-right corner; 44px on touch screens. */
export const closeButtonClass =
  't focus-ring -mt-1 -mr-2 flex size-8 shrink-0 items-center justify-center rounded-md text-ink-2 hover:bg-surface-3 hover:text-ink pointer-coarse:-mt-2.5 pointer-coarse:-mr-3.5 pointer-coarse:size-[3.1429rem]'

/** Header row: eyebrow + title (+ optional lede) on the left, close X on the right. */
export const dialogHeaderClass = 'flex items-start justify-between gap-4'

/** Footer row: actions right-aligned, secondary before primary. */
export const dialogActionsClass = 'mt-6 flex flex-wrap items-center justify-end gap-2'

/** Popover / menu surface (elev-2). */
export const popoverClass =
  'rounded-lg border border-line bg-surface-2 text-ink shadow-elev-2 transition-[opacity,transform] duration-(--dur-standard) ease-(--ease-out) starting:-translate-y-1 starting:opacity-0'

/** A row inside a popover menu: 32px on desktop, 44px on touch; inset focus ring for dense lists. */
export const menuRowClass =
  't focus-ring-inset flex h-8 w-full items-center gap-2 rounded-md px-2 text-left text-sm text-ink hover:bg-surface-3 focus-visible:bg-surface-3 pointer-coarse:h-[3.1429rem]'
