import { useEffect, useRef, useState } from 'react'
import type { KeyboardEvent as ReactKeyboardEvent } from 'react'
import { useFocusTrap } from '../hooks/useFocusTrap'
import { Button } from './ui'
import { cn, isMac } from '../lib/utils'

export interface ResolvePopoverProps {
  mode: 'resolve' | 'reopen'
  open: boolean
  onClose: () => void
  onConfirm: (note: string | null) => void
  /**
   * Where the popover opens relative to its (relatively positioned) parent. `responsive` opens
   * above on phones, where the trigger lives in the bottom action bar, and below from `sm` up.
   */
  placement?: 'below' | 'responsive'
}

/** Popover anchored to its (relatively positioned) parent. */
export function ResolvePopover({
  mode,
  open,
  onClose,
  onConfirm,
  placement = 'below',
}: ResolvePopoverProps) {
  if (!open) return null
  return <PopoverBody mode={mode} onClose={onClose} onConfirm={onConfirm} placement={placement} />
}

function PopoverBody({ mode, onClose, onConfirm, placement }: Omit<ResolvePopoverProps, 'open'>) {
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
      className={cn(
        'panel absolute right-0 z-30 w-80 max-w-[calc(100vw-2rem)] animate-in p-3',
        placement === 'responsive'
          ? 'bottom-full mb-2 sm:top-full sm:bottom-auto sm:mt-2 sm:mb-0'
          : 'top-full mt-2',
      )}
    >
      <textarea
        data-autofocus
        value={note}
        onChange={(e) => setNote(e.target.value)}
        onKeyDown={onKeyDown}
        rows={3}
        placeholder="Add a note (optional)"
        aria-label="Note"
        className="t block w-full resize-none rounded-md border border-line-input bg-surface-2 px-2.5 py-2 text-sm leading-relaxed text-ink outline-none placeholder:text-ink-3 focus:border-focus focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
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
          <span aria-hidden="true" className="-mr-0.5 font-mono text-[11px] opacity-80">
            {isMac ? '⌘↵' : 'Ctrl↵'}
          </span>
        </Button>
      </div>
    </div>
  )
}
