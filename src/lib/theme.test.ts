import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { DEFAULT_SCHEME, applyStoredTheme, toColorScheme, useTheme } from './theme'

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
    expect(meta?.content).toBe('#141412')
  })

  it('applies a stored color scheme', () => {
    mockMatchMedia(false)
    localStorage.setItem('squash:theme', 'dark')
    localStorage.setItem('squash:scheme', 'ocean')
    applyStoredTheme()
    expect(document.documentElement.dataset.scheme).toBe('ocean')
    const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')
    expect(meta?.content).toBe('#141412')
  })

  it.each(['violet', 'forest'])('maps the retired %s scheme to the default', (legacy) => {
    mockMatchMedia(false)
    document.documentElement.setAttribute('data-scheme', 'ocean')
    localStorage.setItem('squash:scheme', legacy)
    applyStoredTheme()
    expect(document.documentElement.hasAttribute('data-scheme')).toBe(false)
    expect(toColorScheme(legacy)).toBe(DEFAULT_SCHEME)
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

  it('recovers from a failed storage write when another tab changes the theme', () => {
    const { result, unmount } = renderHook(() => useTheme())
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota')
    })
    try {
      act(() => result.current.setTheme('dark'))
      expect(result.current.theme).toBe('dark')
    } finally {
      setItem.mockRestore()
    }

    localStorage.setItem('squash:theme', 'light')
    act(() => {
      window.dispatchEvent(new StorageEvent('storage', { key: 'squash:theme', newValue: 'light' }))
    })
    expect(result.current.theme).toBe('light')

    localStorage.clear()
    act(() => {
      window.dispatchEvent(new StorageEvent('storage', { key: null }))
    })
    expect(result.current.theme).toBe('system')
    unmount()
  })
})
