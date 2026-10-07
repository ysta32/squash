import { useCallback, useEffect, useState, useSyncExternalStore } from 'react'

export type Theme = 'light' | 'dark' | 'system'
export type ResolvedTheme = 'light' | 'dark'

/** Schemes only swap the accent; neutrals are always paper (light) or darkroom (dark). */
export const COLOR_SCHEMES = ['viridian', 'ocean', 'sunset', 'rose', 'graphite'] as const
export type ColorScheme = (typeof COLOR_SCHEMES)[number]
export const DEFAULT_SCHEME: ColorScheme = 'viridian'

/** Page background per mode; mirrors --bg in index.css (used for the theme-color meta). */
export const THEME_BG: Record<ResolvedTheme, string> = { light: '#f5f3ee', dark: '#141412' }

/** Labels and preview swatches for the scheme picker; values mirror index.css. */
export const SCHEME_INFO: Record<
  ColorScheme,
  { label: string; accent: Record<ResolvedTheme, string>; bg: Record<ResolvedTheme, string> }
> = {
  viridian: { label: 'Viridian', accent: { light: '#0d6b57', dark: '#4cc4a3' }, bg: THEME_BG },
  ocean: { label: 'Cyanotype', accent: { light: '#1f5fa8', dark: '#7db0f0' }, bg: THEME_BG },
  sunset: { label: 'Rust', accent: { light: '#b4470f', dark: '#f2925a' }, bg: THEME_BG },
  rose: { label: 'Madder', accent: { light: '#b4235a', dark: '#f07aa3' }, bg: THEME_BG },
  graphite: { label: 'Ink', accent: { light: '#1c1b18', dark: '#edeae3' }, bg: THEME_BG },
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

/** Maps a stored value to a current scheme. Retired IDs ('violet', 'forest') and unknown values
 * fall back to the default so an old preference never leaves the app without an accent. */
export function toColorScheme(value: string | null): ColorScheme {
  return (COLOR_SCHEMES as readonly string[]).includes(value ?? '')
    ? (value as ColorScheme)
    : DEFAULT_SCHEME
}

function readStoredScheme(): ColorScheme {
  try {
    return toColorScheme(localStorage.getItem(SCHEME_KEY))
  } catch {
    return DEFAULT_SCHEME
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
  if (scheme === DEFAULT_SCHEME) root.removeAttribute('data-scheme')
  else root.setAttribute('data-scheme', scheme)
  let meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')
  if (!meta) {
    meta = document.createElement('meta')
    meta.name = 'theme-color'
    document.head.appendChild(meta)
  }
  meta.content = THEME_BG[resolved]
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
