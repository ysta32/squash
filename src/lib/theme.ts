import { useCallback, useEffect, useState } from 'react'

export type Theme = 'light' | 'dark' | 'system'
export type ResolvedTheme = 'light' | 'dark'

export const THEME_KEY = 'squash:theme'
const DARK_QUERY = '(prefers-color-scheme: dark)'
const THEME_COLOR: Record<ResolvedTheme, string> = { light: '#ffffff', dark: '#09090b' }

function readStored(): Theme {
  try {
    const v = localStorage.getItem(THEME_KEY)
    return v === 'light' || v === 'dark' || v === 'system' ? v : 'system'
  } catch {
    return 'system'
  }
}

function systemPrefersDark(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia(DARK_QUERY).matches
}

function resolve(theme: Theme): ResolvedTheme {
  if (theme === 'system') return systemPrefersDark() ? 'dark' : 'light'
  return theme
}

function apply(theme: Theme): ResolvedTheme {
  const resolved = resolve(theme)
  document.documentElement.classList.toggle('dark', resolved === 'dark')
  let meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')
  if (!meta) {
    meta = document.createElement('meta')
    meta.name = 'theme-color'
    document.head.appendChild(meta)
  }
  meta.content = THEME_COLOR[resolved]
  return resolved
}

export function applyStoredTheme(): void {
  apply(readStored())
}

export function useTheme(): { theme: Theme; resolved: ResolvedTheme; setTheme(t: Theme): void } {
  const [theme, setThemeState] = useState<Theme>(readStored)
  const [systemDark, setSystemDark] = useState<boolean>(systemPrefersDark)
  const resolved: ResolvedTheme = theme === 'system' ? (systemDark ? 'dark' : 'light') : theme

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return
    const mql = window.matchMedia(DARK_QUERY)
    const onChange = (e: MediaQueryListEvent) => setSystemDark(e.matches)
    mql.addEventListener('change', onChange)
    return () => mql.removeEventListener('change', onChange)
  }, [])

  useEffect(() => {
    apply(theme === 'system' ? (systemDark ? 'dark' : 'light') : theme)
  }, [theme, systemDark])

  const setTheme = useCallback((t: Theme) => {
    try {
      localStorage.setItem(THEME_KEY, t)
    } catch {
      // storage unavailable: theme still applies for this session
    }
    setThemeState(t)
  }, [])

  return { theme, resolved, setTheme }
}
