import { useEffect, useRef } from 'react'
import { X } from 'lucide-react'
import { useOverlayOpen } from '../hooks/useKeyboard'
import { isMac } from '../lib/utils'
import { Kbd } from './ui'

const ALT = isMac ? '⌥' : 'Alt'
const MOD = isMac ? '⌘' : 'Ctrl'

const SHORTCUTS: { keys: string[]; label: string }[] = [
  { keys: [MOD, 'K'], label: 'Command palette' },
  { keys: ['N'], label: 'New bug (focus capture bar)' },
  { keys: [MOD, 'V'], label: 'Paste screenshot and start typing' },
  { keys: ['Enter'], label: 'File bug' },
  { keys: ['Shift', 'Enter'], label: 'New line' },
  { keys: [ALT, '1–4'], label: 'Set severity (low → critical) while capturing' },
  { keys: ['/'], label: 'Search' },
  { keys: ['J'], label: 'Next bug' },
  { keys: ['K'], label: 'Previous bug' },
  { keys: ['R'], label: 'Resolve selected bug' },
  { keys: ['O'], label: 'Reopen selected bug' },
  { keys: ['A'], label: 'Change assignee of selected bug' },
  { keys: ['I'], label: 'Assign selected bug to me (again to unassign)' },
  { keys: ['X'], label: 'Pick selected bug for a Claude export' },
  { keys: ['C'], label: 'Send picked (or selected) bugs to Claude' },
  { keys: ['Esc'], label: 'Close / back to list' },
  { keys: ['?'], label: 'Show keyboard shortcuts' },
]

export interface ShortcutsSheetProps {
  open: boolean
  onClose: () => void
}

export function ShortcutsSheet({ open, onClose }: ShortcutsSheetProps) {
  const closeRef = useRef<HTMLButtonElement>(null)
  const onCloseRef = useRef(onClose)
  useOverlayOpen(open)

  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  useEffect(() => {
    if (!open) return
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null
    closeRef.current?.focus()
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
      previous?.focus()
    }
  }, [open])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="shortcuts-title"
        className="w-full max-w-sm rounded-xl border border-border bg-bg-elevated p-5 text-fg shadow-elevated"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 id="shortcuts-title" className="text-sm font-semibold">
            Keyboard shortcuts
          </h2>
          <button
            ref={closeRef}
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="focus-ring rounded-md p-1 text-muted hover:text-fg"
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>
        <dl className="space-y-2 text-sm">
          {SHORTCUTS.map(({ keys, label }) => (
            <div key={label} className="flex items-center justify-between gap-4">
              <dt className="text-muted">{label}</dt>
              <dd className="flex shrink-0 gap-1">
                {keys.map((k) => (
                  <Kbd key={k}>{k}</Kbd>
                ))}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  )
}
