import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { applyStoredTheme, useTheme } from './theme'

function mockMatchMedia(matches: boolean) {
  vi.stubGlobal(
    'matchMedia',
    vi.fn().mockImplementation((query: string) => ({
      matches,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  )
}

describe('applyStoredTheme', () => {
  beforeEach(() => {
    localStorage.clear()
    document.documentElement.classList.remove('dark')
    document.documentElement.removeAttribute('data-scheme')
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('applies stored dark', () => {
    mockMatchMedia(false)
    localStorage.setItem('squash:theme', 'dark')
    applyStoredTheme()
    expect(document.documentElement.classList.contains('dark')).toBe(true)
  })

  it('removes dark for stored light even if system is dark', () => {
    mockMatchMedia(true)
    document.documentElement.classList.add('dark')
    localStorage.setItem('squash:theme', 'light')
    applyStoredTheme()
    expect(document.documentElement.classList.contains('dark')).toBe(false)
  })

  it('falls back to system dark', () => {
    mockMatchMedia(true)
    applyStoredTheme()
    expect(document.documentElement.classList.contains('dark')).toBe(true)
  })

  it('falls back to system light', () => {
    mockMatchMedia(false)
    applyStoredTheme()
    expect(document.documentElement.classList.contains('dark')).toBe(false)
  })

  it('sets theme-color meta', () => {
    mockMatchMedia(false)
    localStorage.setItem('squash:theme', 'dark')
    applyStoredTheme()
    const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')
    expect(meta?.content).toBe('#1b1b20')
  })

  it('applies a stored color scheme', () => {
    mockMatchMedia(false)
    localStorage.setItem('squash:theme', 'dark')
    localStorage.setItem('squash:scheme', 'forest')
    applyStoredTheme()
    expect(document.documentElement.dataset.scheme).toBe('forest')
    const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')
    expect(meta?.content).toBe('#151c19')
  })

  it('ignores an unknown scheme and uses the default', () => {
    mockMatchMedia(false)
    document.documentElement.setAttribute('data-scheme', 'ocean')
    localStorage.setItem('squash:scheme', 'neon')
    applyStoredTheme()
    expect(document.documentElement.hasAttribute('data-scheme')).toBe(false)
  })
})

describe('useTheme', () => {
  beforeEach(() => {
    localStorage.clear()
    document.documentElement.classList.remove('dark')
    mockMatchMedia(false)
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('shares one theme across consumers and applies each change', () => {
    const a = renderHook(() => useTheme())
    const b = renderHook(() => useTheme())
    expect(a.result.current.theme).toBe('system')

    act(() => a.result.current.setTheme('dark'))
    expect(b.result.current.theme).toBe('dark')
    expect(b.result.current.resolved).toBe('dark')
    expect(document.documentElement.classList.contains('dark')).toBe(true)

    act(() => b.result.current.setTheme('light'))
    expect(a.result.current.theme).toBe('light')
    expect(document.documentElement.classList.contains('dark')).toBe(false)

    act(() => a.result.current.setTheme('dark'))
    expect(b.result.current.theme).toBe('dark')
    expect(localStorage.getItem('squash:theme')).toBe('dark')
    expect(document.documentElement.classList.contains('dark')).toBe(true)
    a.unmount()
    b.unmount()
  })
})
