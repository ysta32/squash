import { useCallback, useSyncExternalStore } from 'react'

/** Touch screens: the primary pointer is a finger, so keyboard-only hints are noise. */
export const COARSE_POINTER_QUERY = '(pointer: coarse)'

function mediaQuery(query: string): MediaQueryList | null {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia(query)
    : null
}

/** Snapshot of a media query for non-hook callers; false when matchMedia is unavailable. */
export function matchesMedia(query: string): boolean {
  return mediaQuery(query)?.matches ?? false
}

/** Live result of a CSS media query; false when matchMedia is unavailable (tests, SSR). */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const mql = mediaQuery(query)
      if (!mql) return () => {}
      // Safari < 14 only has the deprecated addListener.
      if (typeof mql.addEventListener === 'function') {
        mql.addEventListener('change', onChange)
        return () => mql.removeEventListener('change', onChange)
      }
      mql.addListener(onChange)
      return () => mql.removeListener(onChange)
    },
    [query],
  )
  return useSyncExternalStore(
    subscribe,
    () => matchesMedia(query),
    () => false,
  )
}

/** Snapshot for non-hook callers; false when matchMedia is unavailable. */
export function isCoarsePointer(): boolean {
  return matchesMedia(COARSE_POINTER_QUERY)
}

/**
 * True on touch-first devices (`pointer: coarse`). Use it to hide keyboard-only hints (key caps,
 * "press N"), the shortcuts sheet entry point, and to switch wording to "tap". Updates live when
 * the primary pointer changes (e.g. a tablet docked to a keyboard and trackpad).
 */
export function useCoarsePointer(): boolean {
  return useMediaQuery(COARSE_POINTER_QUERY)
}
