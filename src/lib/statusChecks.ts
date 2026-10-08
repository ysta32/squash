// Client-side reachability checks for the /status page: the app origin, the Supabase REST API
// and a Supabase Realtime connection, each timed from this browser. Deliberately independent of
// lib/supabase.ts (which throws without configuration), so the page works on a build without
// Supabase settings and reports those two checks as not configured.

export type CheckState = 'ok' | 'down' | 'unconfigured'

export interface CheckResult {
  state: CheckState
  /** Round-trip time in milliseconds, when an answer (or a failure) was timed. */
  ms: number | null
  detail: string
}

export interface StatusConfig {
  appOrigin: string
  supabaseUrl: string | null
  anonKey: string | null
}

export const CHECK_TIMEOUT_MS = 8000

type Clock = () => number
const defaultClock: Clock = () => performance.now()

/** The Supabase settings baked into this build, or nulls when they are missing or blank. */
export function statusConfig(
  env: Record<string, string | undefined>,
  appOrigin: string,
): StatusConfig {
  const url = env.VITE_SUPABASE_URL?.trim().replace(/\/+$/, '') || null
  const key = env.VITE_SUPABASE_ANON_KEY?.trim() || null
  return { appOrigin, supabaseUrl: url, anonKey: key }
}

async function timedFetch(
  url: string,
  init: RequestInit,
  fetchImpl: typeof fetch,
  now: Clock,
): Promise<{ response: Response | null; ms: number; error: string | null }> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), CHECK_TIMEOUT_MS)
  const start = now()
  try {
    const response = await fetchImpl(url, { ...init, cache: 'no-store', signal: controller.signal })
    return { response, ms: Math.round(now() - start), error: null }
  } catch (error) {
    const timedOut = controller.signal.aborted
    return {
      response: null,
      ms: Math.round(now() - start),
      error: timedOut
        ? `No answer within ${CHECK_TIMEOUT_MS / 1000} s`
        : `Could not connect${error instanceof Error && error.message ? ` (${error.message})` : ''}`,
    }
  } finally {
    clearTimeout(timer)
  }
}

/** Fetches a small static file from the app's own origin, bypassing the cache. */
export async function checkApp(
  config: StatusConfig,
  fetchImpl: typeof fetch = fetch,
  now: Clock = defaultClock,
): Promise<CheckResult> {
  const { response, ms, error } = await timedFetch(
    `${config.appOrigin}/manifest.webmanifest`,
    { method: 'GET' },
    fetchImpl,
    now,
  )
  if (!response) return { state: 'down', ms, detail: error ?? 'Could not connect' }
  if (!response.ok) return { state: 'down', ms, detail: `Answered HTTP ${response.status}` }
  return { state: 'ok', ms, detail: `Answered HTTP ${response.status}` }
}

/**
 * Asks the Supabase REST API (PostgREST) for its root. Any answer below 500 means the API is up
 * and reachable; whether the anon key may read the schema there is a policy question, not an
 * outage, so a 401 still counts as reachable and is shown as such.
 */
export async function checkRest(
  config: StatusConfig,
  fetchImpl: typeof fetch = fetch,
  now: Clock = defaultClock,
): Promise<CheckResult> {
  if (!config.supabaseUrl || !config.anonKey) {
    return { state: 'unconfigured', ms: null, detail: 'This build has no Supabase settings' }
  }
  const { response, ms, error } = await timedFetch(
    `${config.supabaseUrl}/rest/v1/`,
    { method: 'GET', headers: { apikey: config.anonKey } },
    fetchImpl,
    now,
  )
  if (!response) return { state: 'down', ms, detail: error ?? 'Could not connect' }
  if (response.status >= 500) {
    return { state: 'down', ms, detail: `Answered HTTP ${response.status}` }
  }
  return { state: 'ok', ms, detail: `Answered HTTP ${response.status}` }
}

/** The minimal WebSocket surface the Realtime check needs (the browser's, or a test double). */
export interface SocketLike {
  onopen: ((event: Event) => void) | null
  onmessage: ((event: MessageEvent) => void) | null
  onerror: ((event: Event) => void) | null
  onclose: ((event: CloseEvent) => void) | null
  send(data: string): void
  close(): void
}

interface PhoenixReply {
  ref?: unknown
  payload?: { status?: unknown } | null
}

export function realtimeUrl(config: Pick<StatusConfig, 'supabaseUrl' | 'anonKey'>): string {
  const base = (config.supabaseUrl ?? '').replace(/^http/, 'ws')
  return `${base}/realtime/v1/websocket?apikey=${encodeURIComponent(config.anonKey ?? '')}&vsn=1.0.0`
}

/**
 * Opens a Realtime socket and waits for the server to answer a Phoenix heartbeat, so a socket
 * that opens but never speaks is not counted as up. The time covers connect plus one round trip.
 */
export function checkRealtime(
  config: StatusConfig,
  openSocket: (url: string) => SocketLike = (url) => new WebSocket(url),
  now: Clock = defaultClock,
): Promise<CheckResult> {
  if (!config.supabaseUrl || !config.anonKey) {
    return Promise.resolve({
      state: 'unconfigured',
      ms: null,
      detail: 'This build has no Supabase settings',
    })
  }
  return new Promise((resolve) => {
    const start = now()
    let settled = false
    let socket: SocketLike | null = null
    const finish = (result: CheckResult) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      if (socket) {
        socket.onopen = socket.onmessage = socket.onerror = socket.onclose = null
        try {
          socket.close()
        } catch {
          // Already closed or never opened: nothing left to release.
        }
      }
      resolve(result)
    }
    const elapsed = () => Math.round(now() - start)
    const timer = setTimeout(
      () =>
        finish({
          state: 'down',
          ms: elapsed(),
          detail: `No answer within ${CHECK_TIMEOUT_MS / 1000} s`,
        }),
      CHECK_TIMEOUT_MS,
    )
    try {
      socket = openSocket(realtimeUrl(config))
    } catch (error) {
      finish({
        state: 'down',
        ms: elapsed(),
        detail: `Could not connect${error instanceof Error && error.message ? ` (${error.message})` : ''}`,
      })
      return
    }
    socket.onopen = () => {
      socket?.send(
        JSON.stringify({ topic: 'phoenix', event: 'heartbeat', payload: {}, ref: 'status' }),
      )
    }
    socket.onmessage = (event) => {
      let reply: PhoenixReply | null
      try {
        reply = JSON.parse(String(event.data)) as PhoenixReply | null
      } catch {
        return
      }
      if (reply?.ref !== 'status') return
      finish(
        reply.payload?.status === 'ok'
          ? { state: 'ok', ms: elapsed(), detail: 'Connected and answered a heartbeat' }
          : { state: 'down', ms: elapsed(), detail: 'Connected, but the heartbeat was refused' },
      )
    }
    socket.onerror = () => finish({ state: 'down', ms: elapsed(), detail: 'Could not connect' })
    socket.onclose = (event) =>
      finish({
        state: 'down',
        ms: elapsed(),
        detail: `Closed before answering${event.code ? ` (code ${event.code})` : ''}`,
      })
  })
}
