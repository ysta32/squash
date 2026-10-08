import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { COARSE_POINTER_QUERY, isCoarsePointer, useCoarsePointer } from './useCoarsePointer'

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
