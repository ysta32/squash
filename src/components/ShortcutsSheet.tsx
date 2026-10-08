import { useEffect, useRef } from 'react'
import { useOverlayOpen } from '../hooks/useKeyboard'
import { useFocusTrap } from '../hooks/useFocusTrap'
import { cn, isMac } from '../lib/utils'
import { Kbd } from './ui'
import { DialogHeader } from './DialogHeader'
import { dialogClass, eyebrowClass, scrimClass } from './dialogStyles'

/** Fades the last 1.5rem of the scroller so a cut-off list reads as "scroll for more". */
const SCROLL_FADE =
  '[mask-image:linear-gradient(to_bottom,black_calc(100%-1.5rem),transparent)] [-webkit-mask-image:linear-gradient(to_bottom,black_calc(100%-1.5rem),transparent)]'

const ALT = isMac ? '⌥' : 'Alt'
const MOD = isMac ? '⌘' : 'Ctrl'
const ENTER = isMac ? '↵' : 'Enter'

interface Shortcut {
  keys: string[]
  label: string
}

/** Two columns of groups; each group is a hairline-ruled ledger of label → keys. */
const COLUMNS: { title: string; items: Shortcut[] }[][] = [
  [
    {
      title: 'Capture',
      items: [
        { keys: ['N'], label: 'New bug (focus capture bar)' },
        { keys: [MOD, 'V'], label: 'Paste screenshot and start typing' },
        { keys: [ENTER], label: 'File bug' },
        { keys: ['Shift', ENTER], label: 'New line' },
        { keys: [ALT, '1–4'], label: 'Set severity while capturing' },
      ],
    },
    {
      title: 'General',
      items: [
        { keys: [MOD, 'K'], label: 'Command palette' },
        { keys: ['/'], label: 'Search' },
        { keys: [MOD, 'Z'], label: 'Undo the last action' },
        { keys: ['Esc'], label: 'Close / back to list' },
        { keys: ['?'], label: 'Show keyboard shortcuts' },
      ],
    },
  ],
  [
    {
      title: 'Navigate',
      items: [
        { keys: ['J'], label: 'Next bug' },
        { keys: ['K'], label: 'Previous bug' },
      ],
    },
    {
      title: 'Selected bug',
      items: [
        { keys: ['R'], label: 'Resolve' },
        { keys: ['O'], label: 'Reopen' },
        { keys: ['A'], label: 'Change assignee' },
        { keys: ['I'], label: 'Assign to me (again to unassign)' },
        { keys: ['X'], label: 'Pick for a Claude Code export' },
        { keys: ['C'], label: 'Send picked (or selected) to Claude Code' },
      ],
    },
  ],
]

export interface ShortcutsSheetProps {
  open: boolean
  onClose: () => void
}

export function ShortcutsSheet({ open, onClose }: ShortcutsSheetProps) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const onCloseRef = useRef(onClose)
  useOverlayOpen(open)
  useFocusTrap(dialogRef, open, { initialFocus: 'field' })

  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' || e.key === '?') {
        e.preventDefault()
        e.stopPropagation()
        onCloseRef.current()
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => {
      window.removeEventListener('keydown', onKey, true)
    }
  }, [open])

  if (!open) return null

  return (
    <div
      // Phones: a full-height sheet inset 12px, so all four edges stay visible. Wider: centred.
      className={cn(scrimClass, 'flex items-stretch justify-center p-3 sm:items-center sm:p-6')}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="shortcuts-title"
        className={cn(dialogClass, 'flex max-w-200 flex-col overflow-hidden sm:max-h-[85dvh]')}
      >
        <DialogHeader
          eyebrow="Reference · keys"
          title="Keyboard shortcuts"
          titleId="shortcuts-title"
          onClose={onClose}
          className="shrink-0 border-b border-line px-6 pt-6 pb-4"
        />
        <div
          className={cn(
            'grid min-h-0 flex-1 gap-x-10 gap-y-6 overflow-y-auto overscroll-contain px-6 pt-4 pb-6 sm:grid-cols-2',
            SCROLL_FADE,
          )}
        >
          {COLUMNS.map((groups, c) => (
            <div key={c}>
              {groups.map((group) => (
                <section key={group.title} className="not-first:mt-6">
                  <h3 className={cn(eyebrowClass, 'border-b border-line-2 pb-2')}>{group.title}</h3>
                  <dl>
                    {group.items.map(({ keys, label }) => (
                      <div
                        key={label}
                        className="flex min-h-9 items-center justify-between gap-4 border-b border-line py-1.5 text-sm"
                      >
                        <dt className="text-ink-2">{label}</dt>
                        <dd className="flex shrink-0 items-center gap-1">
                          {keys.map((k) => (
                            <Kbd key={k}>{k}</Kbd>
                          ))}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </section>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
