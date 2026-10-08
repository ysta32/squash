import { useCallback, useState, useSyncExternalStore } from 'react'

/**
 * List pane width bounds in px (DESIGN.md "App shell": 400–480, resizable, remembered). Until the
 * user resizes it, the pane is `initial` wide, or `wide` on screens from `WIDE_QUERY` up, where
 * 440px would truncate most titles beside a lot of empty detail space.
 */
export const LIST_WIDTH = { min: 400, max: 480, initial: 440, wide: 480 } as const
export const WIDE_QUERY = '(min-width: 1440px)'
const STORAGE_KEY = 'squash:list-width'

function clamp(width: number): number {
  return Math.round(Math.min(LIST_WIDTH.max, Math.max(LIST_WIDTH.min, width)))
}

function readStored(): number | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw === null) return null
    const stored = Number(raw)
    return Number.isFinite(stored) && stored > 0 ? clamp(stored) : null
  } catch {
    // Storage can be blocked (private mode, sandboxed iframes): fall back to the default.
    return null
  }
}

function writeStored(width: number | null): void {
  try {
    if (width === null) localStorage.removeItem(STORAGE_KEY)
    else localStorage.setItem(STORAGE_KEY, String(width))
  } catch {
    // Not remembered this time; the width still applies for this session.
  }
}

function wideQuery(): MediaQueryList | null {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia(WIDE_QUERY)
    : null
}

function subscribeWide(onChange: () => void): () => void {
  const query = wideQuery()
  query?.addEventListener('change', onChange)
  return () => query?.removeEventListener('change', onChange)
}

/** The width the list pane takes until the user resizes it: wider on wide screens. */
export function defaultListWidth(): number {
  return wideQuery()?.matches ? LIST_WIDTH.wide : LIST_WIDTH.initial
}

/**
 * The list pane width: the user's last committed width if there is one (restored from the last
 * session), otherwise the viewport's default, which follows the window across the 1440px line.
 * `reset` forgets the user's width and goes back to that default.
 */
export function useListWidth(): [number, (width: number, commit?: boolean) => void, () => void] {
  const fallback = useSyncExternalStore(subscribeWide, defaultListWidth, () => LIST_WIDTH.initial)
  const [width, setWidth] = useState(readStored)
  const update = useCallback((next: number, commit = true) => {
    const value = clamp(next)
    setWidth(value)
    if (commit) writeStored(value)
  }, [])
  const reset = useCallback(() => {
    setWidth(null)
    writeStored(null)
  }, [])
  return [width ?? fallback, update, reset]
}
