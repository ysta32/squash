import { useCallback, useEffect, useRef, useState } from 'react'

export interface Scrub {
  /** Which of `count` states the track is in. */
  step: number
  /** How far through that state, 0–1, quantised so it does not re-render every frame. */
  local: number
}

/**
 * Turns the scroll position over a tall track into a continuous position through `count` states.
 *
 * The exact value is written to `--lp-p` on the track as well, so anything that wants to move with
 * the scroll frame by frame (a stroke drawing itself, a bar filling) can read it in CSS without
 * React re-rendering. React only hears about the quantised value.
 */
export function useScrub(count: number, quantum = 0.05) {
  const track = useRef<HTMLDivElement>(null)
  const [scrub, setScrub] = useState<Scrub>({ step: 0, local: 0 })
  const seen = useRef(-1)

  useEffect(() => {
    const el = track.current
    if (!el) return
    let frame = 0

    function read() {
      frame = 0
      const el = track.current
      if (!el) return
      const box = el.getBoundingClientRect()
      // The track is `count` screens tall and the stage is pinned inside it, so the travel is the
      // track's height less the one screen the stage occupies.
      const travel = box.height - window.innerHeight
      const p = travel > 0 ? Math.min(Math.max(-box.top / travel, 0), 1) : 0
      const exact = Math.min(p * count, count - 0.0001)
      const step = Math.floor(exact)
      const local = exact - step
      el.style.setProperty('--lp-p', local.toFixed(3))
      const quantised = Math.round(exact / quantum)
      if (quantised === seen.current) return
      seen.current = quantised
      setScrub({ step, local: Math.round(local / quantum) * quantum })
    }

    function onScroll() {
      frame ||= requestAnimationFrame(read)
    }

    read()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      if (frame) cancelAnimationFrame(frame)
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
    }
  }, [count, quantum])

  /** Scroll the track to the start of a state, so the keys and the scroll agree. */
  const go = useCallback(
    (step: number) => {
      const el = track.current
      if (!el) return
      const box = el.getBoundingClientRect()
      const travel = box.height - window.innerHeight
      const top = box.top + window.scrollY + (travel * (step + 0.08)) / count
      window.scrollTo({ top, behavior: 'smooth' })
    },
    [count],
  )

  return { track, scrub, go }
}
