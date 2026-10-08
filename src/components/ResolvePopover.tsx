import { useEffect, useRef, useState } from 'react'
import type { KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent } from 'react'
import { X } from 'lucide-react'
import { useFocusTrap } from '../hooks/useFocusTrap'
import { Button, ENTER_KEY, Keys, MOD_KEY } from './ui'
import { cn } from '../lib/utils'

export interface ResolvePopoverProps {
  mode: 'resolve' | 'reopen'
  open: boolean
  onClose: () => void
  onConfirm: (note: string | null) => void
  /**
   * Where the popover opens. `below` hangs under its (relatively positioned) parent, aligned to
   * its end edge. `responsive` does the same from `sm` up; on phones, where the trigger lives in
   * the bottom action bar, it becomes a bottom sheet over that bar, so one Resolve is on screen.
   */
  placement?: 'below' | 'responsive'
}

/** How far (px) the phone sheet must be dragged down by its grab bar to close. */
const DISMISS_DRAG = 64

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
  // Phone sheet: dragging its grab bar down past DISMISS_DRAG closes it; a shorter drag springs back.
  const [drag, setDrag] = useState<{ pointerId: number; startY: number; dy: number } | null>(null)

  function onGrabDown(e: ReactPointerEvent<HTMLDivElement>) {
    if (drag || (e.pointerType === 'mouse' && e.button !== 0)) return
    // jsdom has no pointer capture.
    e.currentTarget.setPointerCapture?.(e.pointerId)
    setDrag({ pointerId: e.pointerId, startY: e.clientY, dy: 0 })
  }
  function onGrabMove(e: ReactPointerEvent<HTMLDivElement>) {
    if (drag?.pointerId !== e.pointerId) return
    setDrag({ ...drag, dy: Math.max(0, e.clientY - drag.startY) })
  }
  function onGrabEnd(e: ReactPointerEvent<HTMLDivElement>) {
    if (drag?.pointerId !== e.pointerId) return
    const dismiss = e.type === 'pointerup' && Math.max(0, e.clientY - drag.startY) > DISMISS_DRAG
    setDrag(null)
    if (dismiss) onCloseRef.current()
  }

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

  const sheet = placement === 'responsive'
  return (
    <>
      {/* Phones: a firm scrim behind the sheet; a tap on it lands outside the dialog and closes it. */}
      {sheet && (
        <div
          aria-hidden="true"
          className="fixed inset-0 z-30 animate-fade bg-scrim-strong sm:hidden"
        />
      )}
      <div
        ref={rootRef}
        role="dialog"
        aria-label={`${verb} bug`}
        style={drag && drag.dy > 0 ? { transform: `translateY(${drag.dy}px)` } : undefined}
        className={cn(
          'panel absolute top-full right-0 z-30 mt-2 w-[320px] max-w-[calc(100vw-2rem)] animate-in p-3',
          sheet &&
            'max-sm:fixed max-sm:inset-x-0 max-sm:top-auto max-sm:bottom-0 max-sm:mt-0 max-sm:w-auto max-sm:max-w-none max-sm:animate-[toast-in_200ms_var(--ease-out)] max-sm:rounded-t-xl max-sm:rounded-b-none max-sm:border-x-0 max-sm:border-b-0 max-sm:px-4 max-sm:pt-0 max-sm:pb-[max(0.75rem,env(safe-area-inset-bottom))]',
          sheet && !drag && 'max-sm:transition-transform max-sm:duration-(--dur-standard)',
        )}
      >
        {sheet && (
          // Grab bar and title row: drag down to dismiss, or use the X.
          <div
            data-testid="sheet-grab"
            onPointerDown={onGrabDown}
            onPointerMove={onGrabMove}
            onPointerUp={onGrabEnd}
            onPointerCancel={onGrabEnd}
            className="-mx-4 touch-none px-4 sm:hidden"
          >
            <span
              aria-hidden="true"
              className="mx-auto mt-2 mb-1 block h-1 w-9 rounded-full bg-line-input/60"
            />
            <div className="flex items-center justify-between">
              <p aria-hidden="true" className="specimen-label text-ink-3">
                {mode === 'resolve' ? 'Resolution note' : 'Reopen note'}
              </p>
              <button
                type="button"
                aria-label="Close"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={onClose}
                className="t focus-ring -mr-3 flex size-[44px] items-center justify-center rounded-md text-ink-2 hover:bg-surface-3 hover:text-ink"
              >
                <X size={18} strokeWidth={1.5} absoluteStrokeWidth aria-hidden="true" />
              </button>
            </div>
          </div>
        )}
        <textarea
          data-autofocus
          value={note}
          onChange={(e) => setNote(e.target.value)}
          onKeyDown={onKeyDown}
          rows={3}
          placeholder="Add a note (optional)"
          aria-label="Note"
          className="t block w-full resize-none rounded-md border border-line-input bg-surface-2 px-2.5 py-2 text-sm leading-relaxed text-ink outline-none placeholder:text-ink-3 focus:border-focus focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus pointer-coarse:text-base"
        />
        <div className="mt-3 flex items-center justify-end gap-2">
          <Button
            variant="ghost"
            size="sm"
            className={cn('pointer-coarse:h-[3.1429rem]', sheet && 'max-sm:h-[44px]')}
            onClick={() => confirm(false)}
          >
            {/* Short enough to sit beside the primary on a 320px phone sheet. */}
            Skip note
          </Button>
          <Button
            variant="primary"
            size="sm"
            className={cn('pointer-coarse:h-[3.1429rem]', sheet && 'max-sm:h-[44px] max-sm:flex-1')}
            onClick={() => confirm(true)}
            title={`${MOD_KEY}+Enter`}
          >
            {verb}
            <span
              aria-hidden="true"
              // The shortcut means nothing on touch, or on the phone sheet.
              className={cn('-mr-1 pointer-coarse:hidden', sheet && 'max-sm:hidden')}
            >
              <Keys keys={[MOD_KEY, ENTER_KEY]} tone="accent" />
            </span>
          </Button>
        </div>
      </div>
    </>
  )
}
