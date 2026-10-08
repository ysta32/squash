import { useCallback, useState } from 'react'

/** List pane width bounds in px (DESIGN.md "App shell": 400–480, resizable, remembered). */
export const LIST_WIDTH = { min: 400, max: 480, initial: 440 } as const
const STORAGE_KEY = 'squash:list-width'

function clamp(width: number): number {
  return Math.round(Math.min(LIST_WIDTH.max, Math.max(LIST_WIDTH.min, width)))
}

function readWidth(): number {
  try {
    const stored = Number(localStorage.getItem(STORAGE_KEY))
    return Number.isFinite(stored) && stored > 0 ? clamp(stored) : LIST_WIDTH.initial
  } catch {
    // Storage can be blocked (private mode, sandboxed iframes): fall back to the default.
    return LIST_WIDTH.initial
  }
}

function saveWidth(width: number): void {
  try {
    localStorage.setItem(STORAGE_KEY, String(width))
  } catch {
    // Not remembered this time; the width still applies for this session.
  }
}

/** The list pane width, restored from the last session and saved on every committed change. */
export function useListWidth(): [number, (width: number, commit?: boolean) => void] {
  const [width, setWidth] = useState(readWidth)
  const update = useCallback((next: number, commit = true) => {
    const value = clamp(next)
    setWidth(value)
    if (commit) saveWidth(value)
  }, [])
  return [width, update]
}
