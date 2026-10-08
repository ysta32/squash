import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  CHECK_TIMEOUT_MS,
  checkApp,
  checkRealtime,
  checkRest,
  realtimeUrl,
  statusConfig,
  type SocketLike,
} from './statusChecks'

const configured = statusConfig(
  { VITE_SUPABASE_URL: 'https://abc.supabase.co/', VITE_SUPABASE_ANON_KEY: 'anon key' },
  'https://squash.test',
)

/** A clock that advances 25 ms per reading, so timings are deterministic. */
function steppingClock() {
  let t = 0
  return () => (t += 25)
}

class FakeSocket implements SocketLike {
  onopen: SocketLike['onopen'] = null
  onmessage: SocketLike['onmessage'] = null
  onerror: SocketLike['onerror'] = null
  onclose: SocketLike['onclose'] = null
  sent: string[] = []
  closed = false
  send(data: string) {
    this.sent.push(data)
  }
  close() {
    this.closed = true
  }
}

afterEach(() => {
  vi.useRealTimers()
})

describe('statusConfig', () => {
  it('treats missing or blank settings as unconfigured and trims the URL', () => {
    expect(statusConfig({}, 'https://x')).toEqual({
      appOrigin: 'https://x',
      supabaseUrl: null,
      anonKey: null,
    })
    expect(statusConfig({ VITE_SUPABASE_URL: '  ', VITE_SUPABASE_ANON_KEY: '' }, 'o')).toEqual({
      appOrigin: 'o',
      supabaseUrl: null,
      anonKey: null,
    })
    expect(configured.supabaseUrl).toBe('https://abc.supabase.co')
  })
})

describe('checkApp', () => {
  it('times a fetch of the manifest, uncached', async () => {
    const fetchImpl = vi.fn(async () => new Response('{}', { status: 200 }))
    const result = await checkApp(configured, fetchImpl, steppingClock())
    expect(result).toEqual({ state: 'ok', ms: 25, detail: 'Answered HTTP 200' })
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://squash.test/manifest.webmanifest',
      expect.objectContaining({ cache: 'no-store' }),
    )
  })

  it('reports an HTTP error or a network failure as down', async () => {
    expect(
      await checkApp(configured, async () => new Response('', { status: 503 }), steppingClock()),
    ).toMatchObject({ state: 'down', detail: 'Answered HTTP 503' })
    expect(
      await checkApp(
        configured,
        async () => {
          throw new TypeError('Failed to fetch')
        },
        steppingClock(),
      ),
    ).toMatchObject({ state: 'down', detail: 'Could not connect (Failed to fetch)' })
  })

  it('gives up after the timeout', async () => {
    vi.useFakeTimers()
    const fetchImpl = vi.fn(
      (_url: RequestInfo | URL, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted')))
        }),
    )
    const pending = checkApp(configured, fetchImpl, steppingClock())
    await vi.advanceTimersByTimeAsync(CHECK_TIMEOUT_MS)
    expect(await pending).toMatchObject({ state: 'down', detail: 'No answer within 8 s' })
  })
})

describe('checkRest', () => {
  it('is not configured without settings, and makes no request', async () => {
    const fetchImpl = vi.fn()
    const result = await checkRest(statusConfig({}, 'o'), fetchImpl)
    expect(result).toEqual({
      state: 'unconfigured',
      ms: null,
      detail: 'This build has no Supabase settings',
    })
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('sends the anon key and counts any answer below 500 as reachable', async () => {
    const fetchImpl = vi.fn(async () => new Response('', { status: 401 }))
    expect(await checkRest(configured, fetchImpl, steppingClock())).toEqual({
      state: 'ok',
      ms: 25,
      detail: 'Answered HTTP 401',
    })
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://abc.supabase.co/rest/v1/',
      expect.objectContaining({ headers: { apikey: 'anon key' } }),
    )
    expect(
      await checkRest(configured, async () => new Response('', { status: 502 }), steppingClock()),
    ).toMatchObject({ state: 'down', detail: 'Answered HTTP 502' })
  })
})

describe('checkRealtime', () => {
  it('builds the websocket URL with an encoded key', () => {
    expect(realtimeUrl(configured)).toBe(
      'wss://abc.supabase.co/realtime/v1/websocket?apikey=anon%20key&vsn=1.0.0',
    )
  })

  it('is not configured without settings, and opens no socket', async () => {
    const open = vi.fn()
    expect(await checkRealtime(statusConfig({}, 'o'), open)).toMatchObject({
      state: 'unconfigured',
    })
    expect(open).not.toHaveBeenCalled()
  })

  it('is up only once the server answers a heartbeat', async () => {
    const socket = new FakeSocket()
    const pending = checkRealtime(configured, () => socket, steppingClock())
    socket.onopen?.(new Event('open'))
    const heartbeat = JSON.parse(socket.sent[0]) as { topic: string; event: string; ref: string }
    expect(heartbeat).toMatchObject({ topic: 'phoenix', event: 'heartbeat', ref: 'status' })
    // Unrelated and malformed frames are ignored.
    socket.onmessage?.(new MessageEvent('message', { data: 'not json' }))
    socket.onmessage?.(new MessageEvent('message', { data: JSON.stringify({ ref: 'other' }) }))
    socket.onmessage?.(
      new MessageEvent('message', {
        data: JSON.stringify({ ref: 'status', payload: { status: 'ok' } }),
      }),
    )
    expect(await pending).toEqual({
      state: 'ok',
      ms: 25,
      detail: 'Connected and answered a heartbeat',
    })
    expect(socket.closed).toBe(true)
    expect(socket.onmessage).toBeNull()
  })

  it('reports a refused heartbeat, an error or an early close as down', async () => {
    const refused = new FakeSocket()
    const a = checkRealtime(configured, () => refused, steppingClock())
    refused.onmessage?.(
      new MessageEvent('message', {
        data: JSON.stringify({ ref: 'status', payload: { status: 'error' } }),
      }),
    )
    expect(await a).toMatchObject({
      state: 'down',
      detail: 'Connected, but the heartbeat was refused',
    })

    const failing = new FakeSocket()
    const b = checkRealtime(configured, () => failing, steppingClock())
    failing.onerror?.(new Event('error'))
    expect(await b).toMatchObject({ state: 'down', detail: 'Could not connect' })

    const closing = new FakeSocket()
    const c = checkRealtime(configured, () => closing, steppingClock())
    closing.onclose?.(new CloseEvent('close', { code: 1006 }))
    expect(await c).toMatchObject({ state: 'down', detail: 'Closed before answering (code 1006)' })

    const d = checkRealtime(
      configured,
      () => {
        throw new SyntaxError('bad url')
      },
      steppingClock(),
    )
    expect(await d).toMatchObject({ state: 'down', detail: 'Could not connect (bad url)' })
  })

  it('gives up on a socket that never answers', async () => {
    vi.useFakeTimers()
    const silent = new FakeSocket()
    const pending = checkRealtime(configured, () => silent, steppingClock())
    silent.onopen?.(new Event('open'))
    await vi.advanceTimersByTimeAsync(CHECK_TIMEOUT_MS)
    expect(await pending).toMatchObject({ state: 'down', detail: 'No answer within 8 s' })
    expect(silent.closed).toBe(true)
  })
})
