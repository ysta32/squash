import { useEffect, useRef, useState } from 'react'

/**
 * True once the element has scrolled into view (and stays true). Without IntersectionObserver
 * (old browsers, tests) the content is shown immediately, so nothing can stay hidden.
 */
export function useInView<T extends Element>(): [React.RefObject<T | null>, boolean] {
  const ref = useRef<T>(null)
  const [shown, setShown] = useState(() => typeof IntersectionObserver === 'undefined')

  useEffect(() => {
    const node = ref.current
    if (shown || !node) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setShown(true)
          observer.disconnect()
        }
      },
      { rootMargin: '0px 0px -12% 0px', threshold: 0.12 },
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [shown])

  return [ref, shown]
}
