import { useEffect, useRef, useState } from 'react'

/**
 * Reveal state of an element:
 * - `idle`: not measured yet. Content is fully visible, so nothing depends on JS running.
 * - `hidden`: measured as entirely below the viewport, so fading it out is never seen.
 * - `shown`: it has scrolled into view (and stays shown).
 */
export type RevealState = 'idle' | 'hidden' | 'shown'

/**
 * Scroll-reveal state for an element. Content starts visible and is only hidden once it is known
 * to be off screen, so a slow or missing IntersectionObserver can never leave it invisible.
 * Without IntersectionObserver (old browsers, tests) it is `shown` immediately.
 */
export function useInView<T extends Element>(): [React.RefObject<T | null>, RevealState] {
  const ref = useRef<T>(null)
  const [state, setState] = useState<RevealState>(() =>
    typeof IntersectionObserver === 'undefined' ? 'shown' : 'idle',
  )

  const shown = state === 'shown'

  useEffect(() => {
    const node = ref.current
    if (shown || !node) return
    let first = true
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[entries.length - 1]
        if (entry.isIntersecting) {
          setState('shown')
          observer.disconnect()
        } else if (first) {
          // Only content wholly below the fold waits for a reveal; anything already on screen,
          // or above it (a restored scroll position), stays visible without animating.
          const viewport = window.innerHeight
          if (entry.boundingClientRect.top >= viewport) {
            setState('hidden')
          } else {
            setState('shown')
            observer.disconnect()
          }
        }
        first = false
      },
      { threshold: 0 },
    )
    observer.observe(node)
    return () => observer.disconnect()
    // Keyed on `shown`, not `state`: idle -> hidden keeps the same observer watching.
  }, [shown])

  return [ref, state]
}
