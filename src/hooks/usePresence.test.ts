import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { usePresence } from './usePresence'

const h = vi.hoisted(() => ({
  user: { id: 'me' } as { id: string } | null,
  handlers: {} as Record<string, () => void>,
  statusCb: null as null | ((s: string) => void),
  state: {} as Record<string, unknown[]>,
  track: vi.fn(),
  channelFn: vi.fn(),
  removeChannel: vi.fn(),
}))

vi.mock('../lib/auth', () => ({ useAuth: () => ({ user: h.user }) }))
vi.mock('../lib/supabase', () => ({
  supabase: { channel: h.channelFn, removeChannel: h.removeChannel },
}))

const meta = (user_id: string, viewing: string | null, online_at: string) => ({
  user_id,
  viewing,
  online_at,
})

function fire(event: 'sync' | 'join' | 'leave') {
  act(() => h.handlers[event]())
}

describe('usePresence', () => {
  beforeEach(() => {
    h.user = { id: 'me' }
    h.handlers = {}
    h.statusCb = null
    h.state = {}
    h.track.mockReset().mockResolvedValue('ok')
    h.removeChannel.mockReset()
    h.channelFn.mockReset().mockImplementation(() => {
      const ch = {
        presenceState: () => h.state,
        track: h.track,
        on(_t: string, opts: { event: string }, fn: () => void) {
          h.handlers[opts.event] = fn
          return ch
        },
        subscribe(cb: (s: string) => void) {
          h.statusCb = cb
          return ch
        },
      }
      return ch
    })
  })

  it('does nothing without a user', () => {
    h.user = null
    const { result } = renderHook(() => usePresence('w', null))
    expect(h.channelFn).not.toHaveBeenCalled()
    expect(result.current.online).toEqual([])
  })

  it('opens a keyed channel and tracks self once subscribed', () => {
    const { unmount } = renderHook(() => usePresence('w', 'bug1'))
    expect(h.channelFn).toHaveBeenCalledWith('ws:w:presence', {
      config: { presence: { key: 'me' } },
    })
    expect(h.track).not.toHaveBeenCalled()
    act(() => h.statusCb?.('SUBSCRIBED'))
    expect(h.track).toHaveBeenCalledTimes(1)
    expect(h.track.mock.calls[0][0]).toMatchObject({ user_id: 'me', viewing: 'bug1' })
    unmount()
  })

  it('reflects join and leave, keeps latest meta per key, skips malformed metas', () => {
    const { result, unmount } = renderHook(() => usePresence('w', null))
    h.state = {
      me: [meta('me', null, '2024-01-01T00:00:00Z')],
      u2: [
        meta('u2', 'bug1', '2024-01-01T00:00:00Z'),
        meta('u2', 'bug2', '2024-01-02T00:00:00Z'),
        { user_id: 5 },
      ],
      bad: [{ nope: true }],
    }
    fire('join')
    expect(result.current.online.map((u) => [u.user_id, u.viewing])).toEqual([
      ['me', null],
      ['u2', 'bug2'],
    ])
    h.state = { me: [meta('me', null, '2024-01-01T00:00:00Z')] }
    fire('leave')
    expect(result.current.online.map((u) => u.user_id)).toEqual(['me'])
    unmount()
  })

  it('viewers excludes self and filters by bug', () => {
    const { result, unmount } = renderHook(() => usePresence('w', 'bug1'))
    h.state = {
      me: [meta('me', 'bug1', '2024-01-01T00:00:00Z')],
      u2: [meta('u2', 'bug1', '2024-01-01T00:00:00Z')],
      u3: [meta('u3', 'bug2', '2024-01-01T00:00:00Z')],
    }
    fire('sync')
    expect(result.current.viewers('bug1').map((u) => u.user_id)).toEqual(['u2'])
    expect(result.current.viewers('none')).toEqual([])
    unmount()
  })

  it('re-tracks when the viewed bug changes after subscribing', () => {
    const { rerender, unmount } = renderHook(({ v }) => usePresence('w', v), {
      initialProps: { v: null as string | null },
    })
    act(() => h.statusCb?.('SUBSCRIBED'))
    h.track.mockClear()
    rerender({ v: 'bug9' })
    expect(h.track).toHaveBeenCalledTimes(1)
    expect(h.track.mock.calls[0][0]).toMatchObject({ viewing: 'bug9' })
    unmount()
  })

  it('does not track a viewing change before subscription', () => {
    const { rerender, unmount } = renderHook(({ v }) => usePresence('w', v), {
      initialProps: { v: null as string | null },
    })
    rerender({ v: 'bug9' })
    expect(h.track).not.toHaveBeenCalled()
    unmount()
  })

  it('removes the channel and clears online on unmount', () => {
    const { unmount } = renderHook(() => usePresence('w', null))
    unmount()
    expect(h.removeChannel).toHaveBeenCalledTimes(1)
  })
})
