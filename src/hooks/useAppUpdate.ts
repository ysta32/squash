import { useEffect, useRef } from 'react'

/** How often an open tab looks for a newer deploy. */
const CHECK_MS = 10 * 60_000
/** Shortest gap between two reminders, so focusing the tab again does not nag. */
const REMIND_MS = 10 * 60_000

/** The hashed entry script a built page loads (`/assets/index-<hash>.js`), or null in dev. */
export function entryScript(html: string): string | null {
  return /<script[^>]+src="([^"]*\/assets\/index-[\w-]+\.js)"/.exec(html)?.[1] ?? null
}

/** The entry script this tab is running, or null in dev. */
function runningEntry(): string | null {
  const src = document
    .querySelector<HTMLScriptElement>('script[type="module"][src]')
    ?.getAttribute('src')
  return src ? entryScript(`<script src="${src}"`) : null
}

/** Whether the deployed app is newer than the one this tab loaded. */
export async function isAppOutdated(
  running = runningEntry(),
  fetchPage: () => Promise<string> = async () => {
    const res = await fetch('/', { cache: 'no-store' })
    if (!res.ok) throw new Error(String(res.status))
    return res.text()
  },
): Promise<boolean> {
  if (!running) return false
  const deployed = entryScript(await fetchPage())
  return deployed !== null && deployed !== running
}

/**
 * Tells a long-open tab when a newer Squash is deployed, so it reloads instead of carrying on with
 * old code (for example sending Claude prompts that miss what later releases ask for).
 */
export function useAppUpdate(onOutdated: () => void): void {
  const latest = useRef(onOutdated)
  useEffect(() => {
    latest.current = onOutdated
  })

  useEffect(() => {
    let active = true
    let remindedAt = -Infinity
    const check = async () => {
      if (document.visibilityState !== 'visible' || Date.now() - remindedAt < REMIND_MS) return
      try {
        if (!(await isAppOutdated()) || !active) return
      } catch {
        return // Offline or a failed fetch: try again later.
      }
      remindedAt = Date.now()
      latest.current()
    }
    const onVisible = () => {
      if (document.visibilityState === 'visible') void check()
    }
    const timer = setInterval(() => void check(), CHECK_MS)
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', onVisible)
    return () => {
      active = false
      clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', onVisible)
    }
  }, [])
}
