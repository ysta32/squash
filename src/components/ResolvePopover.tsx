import { useEffect, useRef, useState } from 'react'
import type { KeyboardEvent as ReactKeyboardEvent } from 'react'
import { isMac } from '../lib/utils'

export interface ResolvePopoverProps {
  mode: 'resolve' | 'reopen'
  open: boolean
  onClose: () => void
  onConfirm: (note: string | null) => void
}

/** Popover anchored below its (relatively positioned) parent. */
export function ResolvePopover({ mode, open, onClose, onConfirm }: ResolvePopoverProps) {
  if (!open) return null
  return <PopoverBody mode={mode} onClose={onClose} onConfirm={onConfirm} />
}

function PopoverBody({ mode, onClose, onConfirm }: Omit<ResolvePopoverProps, 'open'>) {
  const [note, setNote] = useState('')
  const rootRef = useRef<HTMLDivElement>(null)
  const onCloseRef = useRef(onClose)
  useEffect(() => {
    onCloseRef.current = onClose
  })

  const verb = mode === 'resolve' ? 'Resolve' : 'Reopen'

  useEffect(() => {
    function onPointerDown(e: MouseEvent) {
      const root = rootRef.current
      if (root && e.target instanceof Node && !root.contains(e.target)) onCloseRef.current()
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        onCloseRef.current()
      }
    }
    document.addEventListener('mousedown', onPointerDown)
    window.addEventListener('keydown', onKey, true)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      window.removeEventListener('keydown', onKey, true)
    }
  }, [])

  function confirm(withNote: boolean) {
    const trimmed = note.trim()
    onConfirm(withNote && trimmed ? trimmed : null)
  }

  function onKeyDown(e: ReactKeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      confirm(true)
    }
  }

  return (
    <div
      ref={rootRef}
      role="dialog"
      aria-label={`${verb} bug`}
      className="absolute top-full right-0 z-30 mt-2 w-72 rounded-lg border border-border bg-bg p-3 shadow-lg"
    >
      <textarea
        autoFocus
        value={note}
        onChange={(e) => setNote(e.target.value)}
        onKeyDown={onKeyDown}
        rows={3}
        placeholder="Add a note (optional)"
        aria-label="Note"
        className="w-full resize-none rounded-md border border-border bg-bg-subtle px-2 py-1.5 text-sm outline-none placeholder:text-muted focus:border-accent"
      />
      <div className="mt-2 flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={() => confirm(false)}
          className="rounded-md px-2 py-1.5 text-xs text-muted hover:bg-bg-subtle hover:text-fg"
        >
          {verb} without note
        </button>
        <button
          type="button"
          onClick={() => confirm(true)}
          title={`${isMac ? '⌘' : 'Ctrl'}+Enter`}
          className="rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-accent-fg hover:opacity-90"
        >
          {verb}
        </button>
      </div>
    </div>
  )
}
