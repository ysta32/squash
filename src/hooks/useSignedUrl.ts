import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const TTL_SECONDS = 3600
/** Refresh a minute before the signed URL actually expires. */
const SAFETY_MS = 60_000
/** Signing attempts per load (initial + retries) and the first backoff delay. */
export const MAX_ATTEMPTS = 3
const RETRY_BASE_MS = 1000

interface CacheEntry {
  url: string
  exp: number
}

const cache = new Map<string, CacheEntry>()
const inflight = new Map<string, Promise<CacheEntry>>()

/** Returns a valid (cached or freshly signed) URL for a path in the `screenshots` bucket. */
export function getSignedUrl(path: string): Promise<CacheEntry> {
  const hit = cache.get(path)
  if (hit && hit.exp > Date.now()) return Promise.resolve(hit)
  if (hit) cache.delete(path)
  const running = inflight.get(path)
  if (running) return running
  const request = supabase.storage
    .from('screenshots')
    .createSignedUrl(path, TTL_SECONDS)
    .then(({ data, error }) => {
      if (error || !data) throw new Error(error?.message ?? 'Could not load image')
      const entry: CacheEntry = {
        url: data.signedUrl,
        exp: Date.now() + TTL_SECONDS * 1000 - SAFETY_MS,
      }
      cache.set(path, entry)
      return entry
    })
    .finally(() => {
      inflight.delete(path)
    })
  inflight.set(path, request)
  return request
}

/** Test helper: forget all cached URLs. */
export function clearSignedUrlCache(): void {
  cache.clear()
  inflight.clear()
}

export function useSignedUrl(storagePath: string | null): string | null {
  const [resolved, setResolved] = useState<{ path: string; url: string | null } | null>(null)
  const [refreshTick, setRefreshTick] = useState(0)

  useEffect(() => {
    if (!storagePath) return
    let active = true
    let timer: ReturnType<typeof setTimeout> | undefined
    let attempts = 0
    let gaveUp = false

    const attempt = () => {
      attempts++
      getSignedUrl(storagePath).then(
        (entry) => {
          if (!active) return
          attempts = 0
          setResolved({ path: storagePath, url: entry.url })
          timer = setTimeout(
            () => setRefreshTick((t) => t + 1),
            Math.max(0, entry.exp - Date.now()),
          )
        },
        (err: unknown) => {
          if (!active) return
          if (attempts < MAX_ATTEMPTS) {
            timer = setTimeout(attempt, RETRY_BASE_MS * 2 ** (attempts - 1))
            return
          }
          console.error('Could not sign screenshot URL', err)
          gaveUp = true
          setResolved({ path: storagePath, url: null })
        },
      )
    }

    // After exhausting retries, try again once the browser is back online.
    const onOnline = () => {
      if (!active || !gaveUp) return
      gaveUp = false
      attempts = 0
      attempt()
    }
    window.addEventListener('online', onOnline)
    attempt()

    return () => {
      active = false
      window.removeEventListener('online', onOnline)
      if (timer !== undefined) clearTimeout(timer)
    }
  }, [storagePath, refreshTick])

  if (!storagePath) return null
  const cached = cache.get(storagePath)
  if (cached) return cached.url
  return resolved?.path === storagePath ? resolved.url : null
}
