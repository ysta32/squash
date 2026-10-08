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
    expect(friendlyError({ message: 'invalid_code' })).toBe('That invite code doesn’t exist.')
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
        getChannels: () => [],
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
        getChannels: () => [],
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

  function mockChannel() {
    const channel = { on: vi.fn(), subscribe: vi.fn() }
    channel.on.mockReturnValue(channel)
    channel.subscribe.mockReturnValue(channel)
    return channel
  }

  it('useWorkspaces ignores obsolete responses after A -> B -> A', async () => {
    vi.resetModules()
    const calls: Deferred<{ data: unknown[]; error: null }>[] = []
    const channel = mockChannel()
    vi.doMock('../lib/supabase', () => ({
      supabase: {
        from: () => ({
          select: () => ({
            eq: () => {
              const d = deferred<{ data: unknown[]; error: null }>()
              calls.push(d)
              return d.promise
            },
          }),
        }),
        channel: () => channel,
        removeChannel: vi.fn(),
        getChannels: () => [],
      },
    }))
    let uid = 'A'
    vi.doMock('../lib/auth', () => ({ useAuth: () => ({ user: { id: uid } }) }))
    const { renderHook, waitFor, act } = await import('@testing-library/react')
    const mod = await import('./useWorkspaces')
    const ws = (id: string) => ({ workspaces: { id, name: id } })
    const { result, rerender } = renderHook(() => mod.useWorkspaces())
    await waitFor(() => expect(calls.length).toBe(1))
    uid = 'B'
    rerender()
    await waitFor(() => expect(calls.length).toBe(2))
    uid = 'A'
    rerender()
    expect(result.current.loading).toBe(true)
    expect(result.current.workspaces).toEqual([])
    await waitFor(() => expect(calls.length).toBe(3))
    const [firstA, b, secondA] = calls
    await act(async () => {
      firstA.resolve({ data: [ws('stale-A')], error: null })
      b.resolve({ data: [ws('B')], error: null })
      await Promise.all([firstA.promise, b.promise])
    })
    expect(result.current.loading).toBe(true)
    expect(result.current.workspaces).toEqual([])
    await act(async () => {
      secondA.resolve({ data: [ws('fresh-A')], error: null })
      await secondA.promise
    })
    expect(result.current.workspaces.map((w) => w.id)).toEqual(['fresh-A'])
    expect(result.current.loading).toBe(false)
  })

  function mockWorkspaceSupabase() {
    const calls: Deferred<{ data: unknown; error: null }>[] = []
    const members = Promise.resolve({ data: [], error: null })
    const channel = mockChannel()
    vi.doMock('../lib/supabase', () => ({
      supabase: {
        from: (table: string) =>
          table === 'workspaces'
            ? {
                select: () => ({
                  eq: () => ({
                    maybeSingle: () => {
                      const d = deferred<{ data: unknown; error: null }>()
                      calls.push(d)
                      return d.promise
                    },
                  }),
                }),
              }
            : { select: () => ({ eq: () => ({ order: () => members }) }) },
        channel: () => channel,
        removeChannel: vi.fn(),
        getChannels: () => [],
      },
    }))
    return calls
  }

  it('useWorkspace ignores obsolete responses after A -> B -> A', async () => {
    vi.resetModules()
    const calls = mockWorkspaceSupabase()
    vi.doMock('../lib/auth', () => ({ useAuth: () => ({ user: { id: 'u1' } }) }))
    const { renderHook, waitFor, act } = await import('@testing-library/react')
    const mod = await import('./useWorkspaces')
    const { result, rerender } = renderHook(({ id }) => mod.useWorkspace(id), {
      initialProps: { id: 'A' },
    })
    await waitFor(() => expect(calls.length).toBe(1))
    rerender({ id: 'B' })
    await waitFor(() => expect(calls.length).toBe(2))
    rerender({ id: 'A' })
    expect(result.current.loading).toBe(true)
    expect(result.current.workspace).toBeNull()
    await waitFor(() => expect(calls.length).toBe(3))
    const [firstA, b, secondA] = calls
    await act(async () => {
      firstA.resolve({ data: { id: 'A', name: 'stale' }, error: null })
      b.resolve({ data: { id: 'B', name: 'B' }, error: null })
      await Promise.all([firstA.promise, b.promise])
    })
    expect(result.current.loading).toBe(true)
    expect(result.current.workspace).toBeNull()
    await act(async () => {
      secondA.resolve({ data: { id: 'A', name: 'fresh' }, error: null })
      await secondA.promise
    })
    expect(result.current.workspace?.name).toBe('fresh')
    expect(result.current.loading).toBe(false)
  })

  it('useWorkspace resets and ignores the previous user within the same workspace', async () => {
    vi.resetModules()
    const calls = mockWorkspaceSupabase()
    let uid = 'u1'
    vi.doMock('../lib/auth', () => ({ useAuth: () => ({ user: { id: uid } }) }))
    const { renderHook, waitFor, act } = await import('@testing-library/react')
    const mod = await import('./useWorkspaces')
    const { result, rerender } = renderHook(() => mod.useWorkspace('W'))
    await waitFor(() => expect(calls.length).toBe(1))
    await act(async () => {
      calls[0].resolve({ data: { id: 'W', name: 'u1-view' }, error: null })
      await calls[0].promise
    })
    expect(result.current.workspace?.name).toBe('u1-view')
    // u1 refreshes again (e.g. realtime) but the response is slow.
    let slow!: Promise<void>
    act(() => {
      slow = result.current.refresh()
    })
    expect(calls.length).toBe(2)
    uid = 'u2'
    rerender()
    expect(result.current.loading).toBe(true)
    expect(result.current.workspace).toBeNull()
    await waitFor(() => expect(calls.length).toBe(3))
    await act(async () => {
      calls[1].resolve({ data: { id: 'W', name: 'u1-late' }, error: null })
      await slow
    })
    expect(result.current.loading).toBe(true)
    expect(result.current.workspace).toBeNull()
    await act(async () => {
      calls[2].resolve({ data: { id: 'W', name: 'u2-view' }, error: null })
      await calls[2].promise
    })
    expect(result.current.workspace?.name).toBe('u2-view')
    expect(result.current.loading).toBe(false)
  })

  it('useWorkspaces ignores a createWorkspace that resolves after a user switch', async () => {
    vi.resetModules()
    const calls: Deferred<{ data: unknown[]; error: null }>[] = []
    const rpc = deferred<{ data: unknown; error: null }>()
    const channel = mockChannel()
    vi.doMock('../lib/supabase', () => ({
      supabase: {
        from: () => ({
          select: () => ({
            eq: () => {
              const d = deferred<{ data: unknown[]; error: null }>()
              calls.push(d)
              return d.promise
            },
          }),
        }),
        rpc: () => rpc.promise,
        channel: () => channel,
        removeChannel: vi.fn(),
        getChannels: () => [],
      },
    }))
    let uid = 'u1'
    vi.doMock('../lib/auth', () => ({ useAuth: () => ({ user: { id: uid } }) }))
    const { renderHook, waitFor, act } = await import('@testing-library/react')
    const mod = await import('./useWorkspaces')
    const ws = (id: string) => ({ workspaces: { id, name: id } })
    const { result, rerender } = renderHook(() => mod.useWorkspaces())
    await waitFor(() => expect(calls.length).toBe(1))
    await act(async () => {
      calls[0].resolve({ data: [ws('u1-ws')], error: null })
      await calls[0].promise
    })
    let pending!: Promise<unknown>
    act(() => {
      pending = result.current.createWorkspace('New')
    })
    uid = 'u2'
    rerender()
    await waitFor(() => expect(calls.length).toBe(2))
    await act(async () => {
      calls[1].resolve({ data: [ws('u2-ws')], error: null })
      await calls[1].promise
    })
    expect(result.current.workspaces.map((w) => w.id)).toEqual(['u2-ws'])
    await act(async () => {
      rpc.resolve({ data: { id: 'created', name: 'New' }, error: null })
      await expect(pending).resolves.toEqual({ id: 'created', name: 'New' })
    })
    for (const d of calls.slice(2)) d.resolve({ data: [ws('u1-late')], error: null })
    await act(async () => {
      await Promise.resolve()
    })
    expect(calls.length).toBe(2)
    expect(result.current.workspaces.map((w) => w.id)).toEqual(['u2-ws'])
    expect(result.current.loading).toBe(false)
  })

  it('useWorkspace ignores a rename that resolves after switching workspaces', async () => {
    vi.resetModules()
    const calls: Deferred<{ data: unknown; error: null }>[] = []
    const update = deferred<{ data: null; error: null }>()
    const members = Promise.resolve({ data: [], error: null })
    const channel = mockChannel()
    vi.doMock('../lib/supabase', () => ({
      supabase: {
        from: (table: string) =>
          table === 'workspaces'
            ? {
                select: () => ({
                  eq: () => ({
                    maybeSingle: () => {
                      const d = deferred<{ data: unknown; error: null }>()
                      calls.push(d)
                      return d.promise
                    },
                  }),
                }),
                update: () => ({ eq: () => update.promise }),
              }
            : { select: () => ({ eq: () => ({ order: () => members }) }) },
        channel: () => channel,
        removeChannel: vi.fn(),
        getChannels: () => [],
      },
    }))
    vi.doMock('../lib/auth', () => ({ useAuth: () => ({ user: { id: 'u1' } }) }))
    const { renderHook, waitFor, act } = await import('@testing-library/react')
    const mod = await import('./useWorkspaces')
    const { result, rerender } = renderHook(({ id }) => mod.useWorkspace(id), {
      initialProps: { id: 'A' },
    })
    await waitFor(() => expect(calls.length).toBe(1))
    await act(async () => {
      calls[0].resolve({ data: { id: 'A', name: 'A' }, error: null })
      await calls[0].promise
    })
    let pending!: Promise<void>
    act(() => {
      pending = result.current.rename('A2')
    })
    rerender({ id: 'B' })
    await waitFor(() => expect(calls.length).toBe(2))
    await act(async () => {
      calls[1].resolve({ data: { id: 'B', name: 'B' }, error: null })
      await calls[1].promise
    })
    expect(result.current.workspace?.id).toBe('B')
    await act(async () => {
      update.resolve({ data: null, error: null })
      await pending
    })
    for (const d of calls.slice(2)) d.resolve({ data: { id: 'A', name: 'A2' }, error: null })
    await act(async () => {
      await Promise.resolve()
    })
    expect(calls.length).toBe(2)
    expect(result.current.workspace?.id).toBe('B')
    expect(result.current.loading).toBe(false)
  })
})

describe('shared realtime topics', () => {
  /** Mimics supabase-js: `channel(topic)` returns the registered channel for an existing topic. */
  function mockRegistry() {
    interface FakeChannel {
      topic: string
      subscribed: boolean
      on: () => FakeChannel
      subscribe: () => FakeChannel
    }
    const registry: FakeChannel[] = []
    const channel = vi.fn((topic: string) => {
      const existing = registry.find((c) => c.topic === `realtime:${topic}`)
      if (existing) return existing
      const c: FakeChannel = {
        topic: `realtime:${topic}`,
        subscribed: false,
        on: () => {
          if (c.subscribed) throw new Error('cannot add listener after subscribe')
          return c
        },
        subscribe: () => {
          c.subscribed = true
          return c
        },
      }
      registry.push(c)
      return c
    })
    const removeChannel = vi.fn((c: FakeChannel) => {
      registry.splice(registry.indexOf(c), 1)
      return Promise.resolve('ok')
    })
    return { registry, channel, removeChannel, getChannels: () => [...registry] }
  }

  it('two useWorkspaces instances for one user get independent channels', async () => {
    vi.resetModules()
    const rt = mockRegistry()
    vi.doMock('../lib/supabase', () => ({
      supabase: {
        from: () => ({ select: () => ({ eq: () => Promise.resolve({ data: [], error: null }) }) }),
        channel: rt.channel,
        removeChannel: rt.removeChannel,
        getChannels: rt.getChannels,
      },
    }))
    vi.doMock('../lib/auth', () => ({ useAuth: () => ({ user: { id: 'u1' } }) }))
    const { renderHook } = await import('@testing-library/react')
    const mod = await import('./useWorkspaces')
    const first = renderHook(() => mod.useWorkspaces())
    const second = renderHook(() => mod.useWorkspaces())
    expect(rt.channel).toHaveBeenCalledTimes(2)
    expect(rt.registry).toHaveLength(2)
    const [a, b] = rt.registry
    expect(a).not.toBe(b)
    first.unmount()
    expect(rt.removeChannel).toHaveBeenCalledTimes(1)
    expect(rt.removeChannel).toHaveBeenCalledWith(a)
    expect(rt.registry).toEqual([b])
    expect(b.subscribed).toBe(true)
    second.unmount()
    expect(rt.registry).toEqual([])
  })

  it('two useWorkspace instances for one workspace get independent channels', async () => {
    vi.resetModules()
    const rt = mockRegistry()
    const ok = (data: unknown) => Promise.resolve({ data, error: null })
    vi.doMock('../lib/supabase', () => ({
      supabase: {
        from: (table: string) =>
          table === 'workspaces'
            ? { select: () => ({ eq: () => ({ maybeSingle: () => ok({ id: 'W', name: 'W' }) }) }) }
            : { select: () => ({ eq: () => ({ order: () => ok([]) }) }) },
        channel: rt.channel,
        removeChannel: rt.removeChannel,
        getChannels: rt.getChannels,
      },
    }))
    vi.doMock('../lib/auth', () => ({ useAuth: () => ({ user: { id: 'u1' } }) }))
    const { renderHook } = await import('@testing-library/react')
    const mod = await import('./useWorkspaces')
    const first = renderHook(() => mod.useWorkspace('W'))
    const second = renderHook(() => mod.useWorkspace('W'))
    expect(rt.registry).toHaveLength(2)
    const [a, b] = rt.registry
    first.unmount()
    expect(rt.removeChannel).toHaveBeenCalledWith(a)
    expect(rt.registry).toEqual([b])
    second.unmount()
    expect(rt.registry).toEqual([])
  })
})
