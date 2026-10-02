import { useEffect, type RefObject } from 'react'
import { useOverlayOpen } from './useKeyboard'

/**
 * Calls onClose on outside pointerdown or Escape while `active`. An active dismissable
 * overlay also pauses global keyboard shortcuts (see useOverlayOpen).
 */
export function useDismiss(
  ref: RefObject<HTMLElement | null>,
  onClose: () => void,
  active = true,
): void {
  useOverlayOpen(active)
  useEffect(() => {
    if (!active) return
    const onDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      // Mark Esc as consumed so global shortcuts underneath ignore it.
      e.preventDefault()
      onClose()
    }
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [ref, onClose, active])
}
