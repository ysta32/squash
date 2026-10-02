import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { applyStoredTheme } from './theme'

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
    expect(meta?.content).toBe('#09090b')
  })
})
