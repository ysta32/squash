import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import {
  ANY_FINE_POINTER_QUERY,
  COARSE_POINTER_QUERY,
  isCoarsePointer,
  isTouchOnly,
  useCoarsePointer,
  useTouchOnly,
} from './useCoarsePointer'

type Listener = () => void

function fakeMatchMedia(initial: boolean) {
  const listeners = new Set<Listener>()
  const mql = {
    matches: initial,
    media: COARSE_POINTER_QUERY,
    addEventListener: vi.fn((_: string, l: Listener) => listeners.add(l)),
    removeEventListener: vi.fn((_: string, l: Listener) => listeners.delete(l)),
  }
  const matchMedia = vi.fn((q: string) => {
    expect(q).toBe(COARSE_POINTER_QUERY)
    return mql
  })
  vi.stubGlobal('matchMedia', matchMedia)
  return {
    mql,
    listeners,
    set(next: boolean) {
      mql.matches = next
      listeners.forEach((l) => l())
    },
  }
}

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

it('is false when matchMedia is unavailable', () => {
  vi.stubGlobal('matchMedia', undefined)
  expect(isCoarsePointer()).toBe(false)
  const { result } = renderHook(() => useCoarsePointer())
  expect(result.current).toBe(false)
})

it('reads the coarse-pointer media query', () => {
  fakeMatchMedia(true)
  expect(isCoarsePointer()).toBe(true)
  const { result } = renderHook(() => useCoarsePointer())
  expect(result.current).toBe(true)
})

it('updates when the primary pointer changes and unsubscribes on unmount', () => {
  const media = fakeMatchMedia(false)
  const { result, unmount } = renderHook(() => useCoarsePointer())
  expect(result.current).toBe(false)
  act(() => media.set(true))
  expect(result.current).toBe(true)
  act(() => media.set(false))
  expect(result.current).toBe(false)
  unmount()
  expect(media.listeners.size).toBe(0)
})

it.each([
  { coarse: true, fine: false, touchOnly: true },
  { coarse: true, fine: true, touchOnly: false },
  { coarse: false, fine: true, touchOnly: false },
  { coarse: false, fine: false, touchOnly: false },
])(
  'touch-only is coarse=$coarse without any fine pointer (fine=$fine)',
  ({ coarse, fine, touchOnly }) => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn((q: string) => ({
        matches: q === COARSE_POINTER_QUERY ? coarse : q === ANY_FINE_POINTER_QUERY ? fine : false,
        media: q,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    )
    expect(isTouchOnly()).toBe(touchOnly)
    const { result } = renderHook(() => useTouchOnly())
    expect(result.current).toBe(touchOnly)
  },
)
