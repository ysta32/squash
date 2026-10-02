import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../lib/supabase', () => ({ supabase: {} }))
vi.mock('../lib/auth', () => ({ useAuth: () => ({ user: null }) }))

import {
  LAST_WORKSPACE_KEY,
  friendlyError,
  getLastWorkspace,
  inviteUrl,
  setLastWorkspace,
} from './useWorkspaces'

describe('inviteUrl', () => {
  it('builds a join url from the origin', () => {
    expect(inviteUrl('ABCD1234')).toBe(`${location.origin}/join/ABCD1234`)
  })
})

describe('last workspace', () => {
  beforeEach(() => localStorage.clear())

  it('returns null when unset', () => {
    expect(getLastWorkspace()).toBeNull()
  })

  it('round-trips through localStorage', () => {
    setLastWorkspace('ws-1')
    expect(localStorage.getItem(LAST_WORKSPACE_KEY)).toBe('ws-1')
    expect(getLastWorkspace()).toBe('ws-1')
  })
})

describe('friendlyError', () => {
  it('maps known codes', () => {
    expect(friendlyError({ message: 'member_limit' })).toBe('This workspace is full (10 members).')
    expect(friendlyError(new Error('workspace_limit'))).toBe('You can own up to 5 workspaces.')
    expect(friendlyError({ message: 'invalid_code' })).toBe("That invite code doesn't exist.")
    expect(friendlyError('P0001: not_owner')).toBe('Only the owner can do that.')
  })

  it('falls back to the raw message or a generic one', () => {
    expect(friendlyError({ message: 'boom' })).toBe('boom')
    expect(friendlyError(null)).toBe('Something went wrong.')
  })
})

describe('stale responses', () => {
  interface Deferred<T> {
    promise: Promise<T>
    resolve: (v: T) => void
  }
  function deferred<T>(): Deferred<T> {
    let resolve!: (v: T) => void
    const promise = new Promise<T>((r) => {
      resolve = r
    })
    return { promise, resolve }
  }

  it('useWorkspaces ignores a previous user response and clears state', async () => {
    vi.resetModules()
    const slow = deferred<{ data: unknown[]; error: null }>()
    const fast = deferred<{ data: unknown[]; error: null }>()
    const queue = [slow, fast]
    const channel = { on: vi.fn(), subscribe: vi.fn() }
    channel.on.mockReturnValue(channel)
    channel.subscribe.mockReturnValue(channel)
    vi.doMock('../lib/supabase', () => ({
      supabase: {
        from: () => ({
          select: () => ({ eq: () => queue.shift()?.promise }),
        }),
        channel: () => channel,
        removeChannel: vi.fn(),
      },
    }))
    let uid = 'u1'
    vi.doMock('../lib/auth', () => ({ useAuth: () => ({ user: { id: uid } }) }))
    const { renderHook, waitFor, act } = await import('@testing-library/react')
    const mod = await import('./useWorkspaces')
    const ws = (id: string) => ({ workspaces: { id, name: id } })
    const { result, rerender } = renderHook(() => mod.useWorkspaces())
    await waitFor(() => expect(queue.length).toBe(1))
    uid = 'u2'
    rerender()
    expect(result.current.workspaces).toEqual([])
    expect(result.current.loading).toBe(true)
    await waitFor(() => expect(queue.length).toBe(0))
    await act(async () => {
      fast.resolve({ data: [ws('B')], error: null })
      await fast.promise
    })
    await act(async () => {
      slow.resolve({ data: [ws('A')], error: null })
      await slow.promise
    })
    expect(result.current.workspaces.map((w) => w.id)).toEqual(['B'])
    expect(result.current.loading).toBe(false)
  })

  it('useWorkspace ignores a response for a previous workspaceId', async () => {
    vi.resetModules()
    const slow = deferred<{ data: unknown; error: null }>()
    const fast = deferred<{ data: unknown; error: null }>()
    const wsQueue = [slow, fast]
    const members = Promise.resolve({ data: [], error: null })
    const channel = { on: vi.fn(), subscribe: vi.fn() }
    channel.on.mockReturnValue(channel)
    channel.subscribe.mockReturnValue(channel)
    vi.doMock('../lib/supabase', () => ({
      supabase: {
        from: (table: string) =>
          table === 'workspaces'
            ? { select: () => ({ eq: () => ({ maybeSingle: () => wsQueue.shift()?.promise }) }) }
            : { select: () => ({ eq: () => ({ order: () => members }) }) },
        channel: () => channel,
        removeChannel: vi.fn(),
      },
    }))
    vi.doMock('../lib/auth', () => ({ useAuth: () => ({ user: { id: 'u1' } }) }))
    const { renderHook, waitFor, act } = await import('@testing-library/react')
    const mod = await import('./useWorkspaces')
    const { result, rerender } = renderHook(({ id }) => mod.useWorkspace(id), {
      initialProps: { id: 'A' },
    })
    await waitFor(() => expect(wsQueue.length).toBe(1))
    rerender({ id: 'B' })
    expect(result.current.loading).toBe(true)
    expect(result.current.workspace).toBeNull()
    await waitFor(() => expect(wsQueue.length).toBe(0))
    await act(async () => {
      fast.resolve({ data: { id: 'B', name: 'B' }, error: null })
      await fast.promise
    })
    await act(async () => {
      slow.resolve({ data: { id: 'A', name: 'A' }, error: null })
      await slow.promise
    })
    expect(result.current.workspace?.id).toBe('B')
    expect(result.current.loading).toBe(false)
  })
})
