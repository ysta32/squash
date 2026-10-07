import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Comment } from '../lib/types'
import { upsertComments, useBug } from './useBug'

type Result = { data: unknown; error: { message: string } | null }

const h = vi.hoisted(() => {
  const state = {
    comments: [] as unknown[],
    deferLoad: false,
    resolveLoad: null as null | ((rows: unknown[]) => void),
    updateResult: { data: null, error: null } as Result,
    deleteResult: { data: [], error: null } as Result,
    stillThere: null as unknown,
    updates: [] as { patch: unknown; id: unknown }[],
    deletes: [] as unknown[],
    handlers: [] as {
      filter: { event: string; table: string; filter?: string }
      cb: (p: unknown) => void
    }[],
    status: null as null | ((s: string) => void),
  }
  return { state }
})

vi.mock('../lib/supabase', () => {
  const { state } = h
  function from(table: string) {
    let mode: 'select' | 'update' | 'delete' = 'select'
    let patch: unknown = null
    let id: unknown = null
    const builder = {
      select: () => builder,
      eq: (_col: string, value: unknown) => {
        id = value
        return builder
      },
      order: () => {
        if (table !== 'comments') return Promise.resolve({ data: [], error: null })
        if (state.deferLoad) {
          return new Promise((resolve) => {
            state.resolveLoad = (rows) => resolve({ data: rows, error: null })
          })
        }
        return Promise.resolve({ data: state.comments, error: null })
      },
      update: (p: unknown) => {
        mode = 'update'
        patch = p
        return builder
      },
      delete: () => {
        mode = 'delete'
        return builder
      },
      maybeSingle: () => {
        if (mode === 'update') {
          state.updates.push({ patch, id })
          return Promise.resolve(state.updateResult)
        }
        return Promise.resolve({ data: state.stillThere, error: null })
      },
      then: (resolve: (r: Result) => void) => {
        if (mode === 'delete') {
          state.deletes.push(id)
          resolve(state.deleteResult)
        }
      },
    }
    return builder
  }
  const channel = {
    on: (_type: string, filter: { event: string; table: string }, cb: (p: unknown) => void) => {
      state.handlers.push({ filter, cb })
      return channel
    },
    subscribe: (cb: (s: string) => void) => {
      state.status = cb
      return channel
    },
  }
  return {
    supabase: {
      from,
      channel: () => channel,
      getChannels: () => [],
      removeChannel: () => Promise.resolve(),
      auth: {
        getSession: () =>
          Promise.resolve({ data: { session: { user: { id: 'u1' } } }, error: null }),
      },
    },
  }
})

function row(id: string, over: Partial<Comment> = {}): Comment {
  return {
    id,
    bug_id: 'b1',
    author_id: 'u1',
    body: `body ${id}`,
    created_at: `2026-01-01T00:00:0${id.slice(1)}Z`,
    edited_at: null,
    ...over,
  }
}

function emit(event: string, payload: unknown) {
  for (const hd of h.state.handlers) {
    if (hd.filter.table === 'comments' && hd.filter.event === event) hd.cb(payload)
  }
}

describe('upsertComments', () => {
  const none = new Set<string>()

  it('adds unknown rows in created_at order', () => {
    expect(upsertComments([row('c2')], [row('c1')], none).map((c) => c.id)).toEqual(['c1', 'c2'])
  })

  it('replaces a row only with a newer edit', () => {
    const edited = row('c1', { body: 'new', edited_at: '2026-01-01T00:01:00Z' })
    expect(upsertComments([row('c1')], [edited], none)[0].body).toBe('new')
    // A stale listing (unedited, or an older edit) does not undo the edit.
    expect(upsertComments([edited], [row('c1')], none)[0].body).toBe('new')
    const older = row('c1', { body: 'old', edited_at: '2026-01-01T00:00:30Z' })
    expect(upsertComments([edited], [older], none)[0].body).toBe('new')
    // Timestamps are compared as instants, not strings.
    const laterOtherFormat = row('c1', { body: 'newer', edited_at: '2026-01-01 00:02:00+00' })
    expect(upsertComments([edited], [laterOtherFormat], none)[0].body).toBe('newer')
  })

  it('drops deleted ids and never re-adds them', () => {
    const deleted = new Set(['c1'])
    expect(upsertComments([row('c1'), row('c2')], [], deleted).map((c) => c.id)).toEqual(['c2'])
    expect(upsertComments([], [row('c1')], deleted)).toEqual([])
  })

  it('prunes snapshot ids missing from a full listing, keeping later arrivals', () => {
    const current = [row('c1'), row('c2'), row('c3')]
    const result = upsertComments(current, [row('c1')], none, new Set(['c1', 'c2']))
    expect(result.map((c) => c.id)).toEqual(['c1', 'c3'])
  })

  it('returns the same array when nothing changes', () => {
    const current = [row('c1')]
    expect(upsertComments(current, [row('c1')], none)).toBe(current)
  })
})

describe('useBug comments', () => {
  beforeEach(() => {
    Object.assign(h.state, {
      comments: [row('c1'), row('c2')],
      deferLoad: false,
      resolveLoad: null,
      updateResult: { data: null, error: null },
      deleteResult: { data: [], error: null },
      stillThere: null,
      updates: [],
      deletes: [],
      handlers: [],
      status: null,
    })
  })
  afterEach(() => vi.clearAllMocks())

  async function mount() {
    const hook = renderHook(() => useBug('b1'))
    act(() => h.state.status?.('SUBSCRIBED'))
    await waitFor(() => expect(hook.result.current.loading).toBe(false))
    return hook
  }

  it('subscribes to UPDATE (filtered) and DELETE (unfiltered) on comments', async () => {
    await mount()
    const filters = h.state.handlers.filter((hd) => hd.filter.table === 'comments')
    expect(filters.map((hd) => hd.filter)).toEqual([
      expect.objectContaining({ event: 'INSERT', filter: 'bug_id=eq.b1' }),
      expect.objectContaining({ event: 'UPDATE', filter: 'bug_id=eq.b1' }),
      { event: 'DELETE', schema: 'public', table: 'comments' },
    ])
  })

  it('applies realtime UPDATE and DELETE events', async () => {
    const { result } = await mount()
    act(() =>
      emit('UPDATE', { new: row('c1', { body: 'changed', edited_at: '2026-02-01T00:00:00Z' }) }),
    )
    expect(result.current.comments[0]).toMatchObject({ body: 'changed' })
    act(() => emit('DELETE', { old: { id: 'other-bug-comment' } }))
    expect(result.current.comments).toHaveLength(2)
    act(() => emit('DELETE', { old: { id: 'c1' } }))
    expect(result.current.comments.map((c) => c.id)).toEqual(['c2'])
    // A late INSERT echo for the deleted comment does not bring it back.
    act(() => emit('INSERT', { new: row('c1') }))
    expect(result.current.comments.map((c) => c.id)).toEqual(['c2'])
  })

  it('drops comments deleted while disconnected on the next resubscribe', async () => {
    const { result } = await mount()
    h.state.comments = [row('c2')]
    act(() => h.state.status?.('SUBSCRIBED'))
    await waitFor(() => expect(result.current.comments.map((c) => c.id)).toEqual(['c2']))
  })

  it('editComment sends only the trimmed body and applies the returned row', async () => {
    const { result } = await mount()
    h.state.updateResult = {
      data: row('c1', { body: 'fixed', edited_at: '2026-02-01T00:00:00Z' }),
      error: null,
    }
    await act(() => result.current.editComment('c1', '  fixed  '))
    expect(h.state.updates).toEqual([{ patch: { body: 'fixed' }, id: 'c1' }])
    expect(result.current.comments[0]).toMatchObject({
      body: 'fixed',
      edited_at: '2026-02-01T00:00:00Z',
    })
  })

  it('editComment rejects empty text and rows RLS hides', async () => {
    const { result } = await mount()
    await expect(result.current.editComment('c1', '   ')).rejects.toThrow('Comment is empty.')
    await expect(result.current.editComment('c1', 'x')).rejects.toThrow('can no longer be edited')
    h.state.updateResult = { data: null, error: { message: 'boom' } }
    await expect(result.current.editComment('c1', 'x')).rejects.toThrow('boom')
  })

  it('deleteComment removes the comment, and errors when the row is still there', async () => {
    const { result } = await mount()
    h.state.deleteResult = { data: [{ id: 'c1' }], error: null }
    await act(() => result.current.deleteComment('c1'))
    expect(h.state.deletes).toEqual(['c1'])
    expect(result.current.comments.map((c) => c.id)).toEqual(['c2'])

    h.state.deleteResult = { data: [], error: null }
    h.state.stillThere = { id: 'c2' }
    await expect(result.current.deleteComment('c2')).rejects.toThrow('You cannot delete')
    expect(result.current.comments.map((c) => c.id)).toEqual(['c2'])
  })
})
