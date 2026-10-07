import { cleanup, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, expect, it } from 'vitest'
import { useUnreadTitle } from './useUnreadTitle'

beforeEach(() => {
  document.title = 'Squash'
})
afterEach(cleanup)

it('formats unread counts without accumulating prefixes and resets at zero', () => {
  const { rerender, unmount } = renderHook(({ count }) => useUnreadTitle(count), {
    initialProps: { count: 0 },
  })
  expect(document.title).toBe('Squash')
  rerender({ count: 1 })
  expect(document.title).toBe('(1) Squash')
  rerender({ count: 12 })
  expect(document.title).toBe('(12) Squash')
  rerender({ count: 0 })
  expect(document.title).toBe('Squash')
  rerender({ count: 2 })
  unmount()
  expect(document.title).toBe('Squash')
})

it('uses an explicit base title and restores the original on cleanup', () => {
  const { rerender, unmount } = renderHook(({ count, base }) => useUnreadTitle(count, base), {
    initialProps: { count: 3, base: 'Team' },
  })
  expect(document.title).toBe('(3) Team')
  rerender({ count: 4, base: 'Other team' })
  expect(document.title).toBe('(4) Other team')
  rerender({ count: 0, base: 'Other team' })
  expect(document.title).toBe('Other team')
  unmount()
  expect(document.title).toBe('Squash')
})
