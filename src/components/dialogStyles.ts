// Shared chrome for the app's modal dialogs (Invite, Shortcuts, Claude setup) and the palette.
// DESIGN.md §5 "Dialogs": surface-2, radius-xl, elev-3, 24px padding, lg title, opacity plus a
// 4px rise at --dur-emphasis. @starting-style drives the entrance, so it needs no JS and the global
// reduced-motion rule turns it into a short opacity fade.

/** Full-screen scrim. Click-outside handling stays with each dialog. */
export const scrimClass =
  'fixed inset-0 z-50 bg-scrim transition-opacity duration-(--dur-emphasis) ease-(--ease-out) starting:opacity-0'

/** The dialog panel itself; callers add width, padding and layout. */
export const dialogClass =
  'relative w-full rounded-xl border border-line bg-surface-2 text-ink shadow-elev-3 outline-none transition-[opacity,transform] duration-(--dur-emphasis) ease-(--ease-out) starting:translate-y-1 starting:opacity-0'

/** `lg` dialog title. */
export const dialogTitleClass = 'text-lg font-semibold text-ink'

/** Mono uppercase eyebrow, as used for specimen labels and group headings. */
export const eyebrowClass = 'specimen-label'

/** 32px icon-only close button that sits in the dialog's top-right corner. */
export const closeButtonClass =
  't focus-ring -mt-1 -mr-2 flex size-8 shrink-0 items-center justify-center rounded-md text-ink-2 hover:bg-surface-3 hover:text-ink pointer-coarse:size-11'

/** Footer row: actions right-aligned, secondary before primary. */
export const dialogActionsClass = 'mt-6 flex flex-wrap items-center justify-end gap-2'

/** Popover / menu surface (elev-2). */
export const popoverClass =
  'rounded-lg border border-line bg-surface-2 text-ink shadow-elev-2 transition-[opacity,transform] duration-(--dur-standard) ease-(--ease-out) starting:-translate-y-1 starting:opacity-0'

/** A row inside a popover menu: 32px on desktop, 44px on touch; inset focus ring for dense lists. */
export const menuRowClass =
  't focus-ring-inset flex h-8 w-full items-center gap-2 rounded-md px-2 text-left text-sm text-ink hover:bg-surface-3 focus-visible:bg-surface-3 pointer-coarse:h-11'
