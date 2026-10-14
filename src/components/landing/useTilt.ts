import { useEffect, useRef } from 'react'

/**
 * Tilts an element toward the pointer anywhere in the section it belongs to, so the capture below
 * the headline sits in space rather than flat on the page. Mouse only: a touch screen has no
 * hover to follow, and under `prefers-reduced-motion` the plane keeps its resting angle and
 * never moves.
 */
export function useTilt<T extends HTMLElement>(max = 4.5) {
  const stage = useRef<T>(null)
  const plane = useRef<T>(null)

  useEffect(() => {
    const stageEl = stage.current
    const planeEl = plane.current
    if (!stageEl || !planeEl) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return

    function move(event: PointerEvent) {
      const box = stageEl!.getBoundingClientRect()
      const x = (event.clientX - box.left) / box.width - 0.5
      const y = (event.clientY - box.top) / box.height - 0.5
      planeEl!.style.setProperty('--lp-ry', `${(x * max * 2).toFixed(2)}deg`)
      planeEl!.style.setProperty('--lp-rx', `${(-y * max).toFixed(2)}deg`)
    }
    function rest() {
      planeEl!.style.removeProperty('--lp-rx')
      planeEl!.style.removeProperty('--lp-ry')
    }

    stageEl.addEventListener('pointermove', move)
    stageEl.addEventListener('pointerleave', rest)
    return () => {
      stageEl.removeEventListener('pointermove', move)
      stageEl.removeEventListener('pointerleave', rest)
    }
  }, [max])

  return [stage, plane] as const
}
