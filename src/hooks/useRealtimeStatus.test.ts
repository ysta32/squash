import { act, configure, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { openChannel, useRealtimeStatus } from './useRealtimeStatus'

type StatusCb = (status: string) => void

const h = vi.hoisted(() => ({
  cb: null as null | ((s: string) => void),
  cbs: [] as ((s: string) => void)[],
  channels: [] as { topic: string }[],
  channel: vi.fn(),
  removeChannel: vi.fn(),
}))

vi.mock('../lib/supabase', () => ({
  supabase: {
    getChannels: () => h.channels,
    channel: h.channel,
    removeChannel: h.removeChannel,
  },
}))

function setOnline(value: boolean) {
  Object.defineProperty(window.navigator, 'onLine', { value, configurable: true })
}

describe('useRealtimeStatus', () => {
  beforeEach(() => {
    h.cb = null
    h.cbs = []
    h.channels = []
    h.channel.mockReset().mockImplementation((topic: string) => ({
      topic,
      subscribe: (cb: StatusCb) => {
        h.cb = cb
        h.cbs.push(cb)
      },
    }))
    h.removeChannel.mockReset()
    setOnline(true)
  })

  it('is optimistically connected, reconnecting on trouble, connected on SUBSCRIBED', () => {
    const { result, unmount } = renderHook(() => useRealtimeStatus())
    expect(result.current).toBe('connected')
    act(() => h.cb?.('CHANNEL_ERROR'))
    expect(result.current).toBe('reconnecting')
    act(() => h.cb?.('SUBSCRIBED'))
    expect(result.current).toBe('connected')
    act(() => h.cb?.('TIMED_OUT'))
    expect(result.current).toBe('reconnecting')
    unmount()
  })

  it('reports offline when the browser is offline and recovers on online', () => {
    const { result, unmount } = renderHook(() => useRealtimeStatus())
    act(() => h.cb?.('CHANNEL_ERROR'))
    act(() => {
      setOnline(false)
      window.dispatchEvent(new Event('offline'))
    })
    expect(result.current).toBe('offline')
    act(() => {
      setOnline(true)
      window.dispatchEvent(new Event('online'))
    })
    expect(result.current).toBe('reconnecting')
    unmount()
  })

  it('removes the channel on unmount', () => {
    const { unmount } = renderHook(() => useRealtimeStatus())
    unmount()
    expect(h.removeChannel).toHaveBeenCalledTimes(1)
    expect(h.removeChannel.mock.calls[0][0].topic).toBe('status')
  })

  it('ignores status callbacks from a replaced subscription', () => {
    configure({ reactStrictMode: true })
    const { result, unmount } = renderHook(() => useRealtimeStatus())
    expect(h.cbs).toHaveLength(2)
    const [stale, live] = h.cbs
    act(() => stale('CHANNEL_ERROR'))
    expect(result.current).toBe('connected')
    act(() => live('CLOSED'))
    expect(result.current).toBe('reconnecting')
    unmount()
    configure({ reactStrictMode: false })
  })
})

describe('openChannel', () => {
  beforeEach(() => {
    h.channels = []
    h.channel.mockReset().mockImplementation((topic: string) => ({ topic }))
  })

  it('uses the plain topic when free', () => {
    openChannel('t')
    expect(h.channel).toHaveBeenCalledWith('t')
  })

  it('appends a unique suffix when the topic is already registered', () => {
    h.channels = [{ topic: 'realtime:t' }]
    openChannel('t')
    const name = h.channel.mock.calls[0][0] as string
    expect(name).toMatch(/^t:.+/)
  })
})
