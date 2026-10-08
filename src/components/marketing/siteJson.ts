import { useCallback, useEffect, useState } from 'react'
import { content } from './content'

export type SiteJson<T> =
  { state: 'loading' } | { state: 'ready'; data: T } | { state: 'error'; message: string }

const cache = new Map<string, Promise<unknown>>()

/** Fetches a build-time JSON file (vite-plugin-content.ts); one request per file per visit. */
export function loadSiteJson<T>(path: string): Promise<T> {
  const url = `${path}?v=${content.version}`
  let pending = cache.get(url)
  if (!pending) {
    pending = fetch(url).then(async (response) => {
      if (!response.ok) throw new Error(`${path} answered HTTP ${response.status}`)
      return (await response.json()) as unknown
    })
    // A failed request is not cached, so Retry asks again.
    pending.catch(() => cache.delete(url))
    cache.set(url, pending)
  }
  return pending as Promise<T>
}

/** Test hook: forget every cached response. */
export function clearSiteJsonCache() {
  cache.clear()
}

export function useSiteJson<T>(path: string): SiteJson<T> & { retry: () => void } {
  const [attempt, setAttempt] = useState(0)
  const [result, setResult] = useState<{ key: string; value: SiteJson<T> } | null>(null)
  const key = `${path}#${attempt}`

  useEffect(() => {
    let live = true
    loadSiteJson<T>(path).then(
      (data) => live && setResult({ key, value: { state: 'ready', data } }),
      (error: unknown) =>
        live &&
        setResult({
          key,
          value: {
            state: 'error',
            message: error instanceof Error ? error.message : String(error),
          },
        }),
    )
    return () => {
      live = false
    }
  }, [path, key])

  const retry = useCallback(() => setAttempt((n) => n + 1), [])
  // A result for another path (or an earlier attempt) is stale: show loading until this one lands.
  const value: SiteJson<T> = result?.key === key ? result.value : { state: 'loading' }
  return { ...value, retry }
}
