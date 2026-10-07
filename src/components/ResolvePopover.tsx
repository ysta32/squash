import { useEffect, useRef, useState } from 'react'
import type { KeyboardEvent as ReactKeyboardEvent } from 'react'
import { useFocusTrap } from '../hooks/useFocusTrap'
import { Button } from './ui'
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
  useFocusTrap(rootRef)
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
      className="absolute top-full right-0 z-30 mt-2 w-80 max-w-[calc(100vw-2rem)] rounded-lg border border-border bg-bg-elevated p-3 shadow-elevated"
    >
      <textarea
        data-autofocus
        value={note}
        onChange={(e) => setNote(e.target.value)}
        onKeyDown={onKeyDown}
        rows={3}
        placeholder="Add a note (optional)"
        aria-label="Note"
        className="t block w-full resize-none rounded-md border border-border bg-bg px-2.5 py-2 text-sm leading-relaxed outline-none placeholder:text-muted hover:border-fg/20 focus:border-accent/60 focus:ring-3 focus:ring-accent/15"
      />
      <div className="mt-3 flex items-center justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={() => confirm(false)}>
          {verb} without note
        </Button>
        <Button
          variant="primary"
          size="sm"
          onClick={() => confirm(true)}
          title={`${isMac ? '⌘' : 'Ctrl'}+Enter`}
        >
          {verb}
          <span aria-hidden="true" className="-mr-0.5 text-[11px] opacity-70">
            {isMac ? '⌘↵' : 'Ctrl↵'}
          </span>
        </Button>
      </div>
    </div>
  )
}
