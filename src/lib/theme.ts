import { useCallback, useEffect, useState, useSyncExternalStore } from 'react'

export type Theme = 'light' | 'dark' | 'system'
export type ResolvedTheme = 'light' | 'dark'

export const COLOR_SCHEMES = ['violet', 'ocean', 'forest', 'sunset', 'rose', 'graphite'] as const
export type ColorScheme = (typeof COLOR_SCHEMES)[number]

/** Labels and preview swatches for the scheme picker; values mirror index.css. */
export const SCHEME_INFO: Record<
  ColorScheme,
  { label: string; accent: Record<ResolvedTheme, string>; bg: Record<ResolvedTheme, string> }
> = {
  violet: {
    label: 'Violet',
    accent: { light: '#7c3aed', dark: '#a78bfa' },
    bg: { light: '#ffffff', dark: '#1b1b20' },
  },
  ocean: {
    label: 'Ocean',
    accent: { light: '#2563eb', dark: '#60a5fa' },
    bg: { light: '#ffffff', dark: '#161b24' },
  },
  forest: {
    label: 'Forest',
    accent: { light: '#059669', dark: '#34d399' },
    bg: { light: '#ffffff', dark: '#151c19' },
  },
  sunset: {
    label: 'Sunset',
    accent: { light: '#ea580c', dark: '#fb923c' },
    bg: { light: '#ffffff', dark: '#1d1916' },
  },
  rose: {
    label: 'Rose',
    accent: { light: '#e11d48', dark: '#fb7185' },
    bg: { light: '#ffffff', dark: '#1d171a' },
  },
  graphite: {
    label: 'Graphite',
    accent: { light: '#262626', dark: '#e5e5e5' },
    bg: { light: '#ffffff', dark: '#171717' },
  },
}

export const THEME_KEY = 'squash:theme'
export const SCHEME_KEY = 'squash:scheme'
const DARK_QUERY = '(prefers-color-scheme: dark)'

function readStored(): Theme {
  try {
    const v = localStorage.getItem(THEME_KEY)
    return v === 'light' || v === 'dark' || v === 'system' ? v : 'system'
  } catch {
    return 'system'
  }
}

function readStoredScheme(): ColorScheme {
  try {
    const v = localStorage.getItem(SCHEME_KEY)
    return (COLOR_SCHEMES as readonly string[]).includes(v ?? '') ? (v as ColorScheme) : 'violet'
  } catch {
    return 'violet'
  }
}

function systemPrefersDark(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia(DARK_QUERY).matches
}

function resolve(theme: Theme): ResolvedTheme {
  if (theme === 'system') return systemPrefersDark() ? 'dark' : 'light'
  return theme
}

function apply(theme: Theme, scheme: ColorScheme = readStoredScheme()): ResolvedTheme {
  const resolved = resolve(theme)
  const root = document.documentElement
  root.classList.toggle('dark', resolved === 'dark')
  if (scheme === 'violet') root.removeAttribute('data-scheme')
  else root.setAttribute('data-scheme', scheme)
  let meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')
  if (!meta) {
    meta = document.createElement('meta')
    meta.name = 'theme-color'
    document.head.appendChild(meta)
  }
  meta.content = SCHEME_INFO[scheme].bg[resolved]
  return resolved
}

export function applyStoredTheme(): void {
  apply(readStored())
}

export const NEXT_THEME: Record<Theme, Theme> = { light: 'dark', dark: 'system', system: 'light' }

/** Theme chosen this session when storage refused the write; storage is the source of truth otherwise. */
let unstoredTheme: Theme | null = null
const themeListeners = new Set<() => void>()

function getThemeSnapshot(): Theme {
  return unstoredTheme ?? readStored()
}

function subscribeTheme(listener: () => void): () => void {
  themeListeners.add(listener)
  const onStorage = (e: StorageEvent) => {
    if (e.key !== THEME_KEY && e.key !== null) return
    unstoredTheme = null
    listener()
  }
  window.addEventListener('storage', onStorage)
  return () => {
    themeListeners.delete(listener)
    window.removeEventListener('storage', onStorage)
  }
}

/** Sets the theme for every useTheme consumer and applies it right away. */
export function setStoredTheme(t: Theme): void {
  try {
    localStorage.setItem(THEME_KEY, t)
    unstoredTheme = null
  } catch {
    unstoredTheme = t
  }
  apply(t)
  for (const listener of themeListeners) listener()
}

export function useTheme(): { theme: Theme; resolved: ResolvedTheme; setTheme(t: Theme): void } {
  const theme = useSyncExternalStore(subscribeTheme, getThemeSnapshot, getThemeSnapshot)
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

  return { theme, resolved, setTheme: setStoredTheme }
}

/** The accent color scheme, applied on top of whichever light/dark mode is active. */
export function useColorScheme(): { scheme: ColorScheme; setScheme(s: ColorScheme): void } {
  const [scheme, setSchemeState] = useState<ColorScheme>(readStoredScheme)

  const setScheme = useCallback((s: ColorScheme) => {
    try {
      localStorage.setItem(SCHEME_KEY, s)
    } catch {
      // storage unavailable: scheme still applies for this session
    }
    setSchemeState(s)
    apply(readStored(), s)
  }, [])

  return { scheme, setScheme }
}
