import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { BugWithMeta } from '../lib/types'
import { uploadAttachment } from '../lib/upload'
import { removeScreenshots } from '../lib/storageCleanup'
import { compressImage } from './useImageCompression'
import {
  applySnapshot,
  countBugs,
  filterBugs,
  resetPendingUploads,
  retainedUploadCount,
  sortBugs,
  useBugs,
} from './useBugs'

type Result = { data: unknown; error: { message: string } | null }

const h = vi.hoisted(() => {
  const state = {
    selectResult: { data: [] as unknown[], error: null } as Result,
    insertResult: { data: null, error: null } as Result,
    inserted: [] as unknown[],
    insertFailOnce: null as Result | null,
    resolveInsert: null as null | ((r: Result) => void),
    deferInsert: false,
    selectCalls: 0,
    autoSubscribe: true,
    updateResult: { error: null } as { error: { message: string } | null },
    resolveUpdate: null as null | ((r: { error: { message: string } | null }) => void),
    deferUpdate: false,
    updated: [] as { table: string; patch: unknown }[],
    deferSelect: false,
    resolveSelect: null as null | ((r: Result) => void),
    deleteResult: { data: [{ id: 'x' }], error: null } as Result,
    deleted: [] as string[],
    channels: [] as {
      topic: string
      handlers: { filter: { event: string; table: string }; cb: (p: unknown) => void }[]
      status: ((s: string) => void) | null
    }[],
  }
  return { state }
})

vi.mock('../lib/supabase', () => {
  const { state } = h
  function queryBuilder(table: string) {
    const builder = {
      select: () => builder,
      eq: () => builder,
      order: () => builder,
      limit: () => {
        state.selectCalls++
        if (state.deferSelect) {
          return new Promise<Result>((resolve) => {
            state.resolveSelect = resolve
          })
        }
        return Promise.resolve(state.selectResult)
      },
      maybeSingle: () => Promise.resolve({ data: null, error: null }),
      insert: (row: unknown) => {
        state.inserted.push({ table, row })
        return {
          select: () => ({
            single: () =>
              state.insertFailOnce
                ? Promise.resolve(
                    (() => {
                      const fail = state.insertFailOnce as Result
                      state.insertFailOnce = null
                      return fail
                    })(),
                  )
                : state.deferInsert
                  ? new Promise<Result>((resolve) => {
                      state.resolveInsert = resolve
                    })
                  : Promise.resolve(
                      state.insertResult.data
                        ? {
                            data: {
                              ...(state.insertResult.data as object),
                              id: (row as { id: string }).id,
                            },
                            error: null,
                          }
                        : state.insertResult,
                    ),
          }),
        }
      },
      delete: () => ({
        eq: (_col: string, id: string) => ({
          select: () => {
            if (!state.deleteResult.error) state.deleted.push(id)
            return Promise.resolve(state.deleteResult)
          },
        }),
      }),
      update: (patch: unknown) => {
        state.updated.push({ table, patch })
        return {
          eq: () =>
            state.deferUpdate
              ? new Promise<{ error: { message: string } | null }>((resolve) => {
                  state.resolveUpdate = resolve
                })
              : Promise.resolve(state.updateResult),
        }
      },
    }
    return builder
  }
  const supabase = {
    from: (table: string) => queryBuilder(table),
    auth: {
      getSession: () => Promise.resolve({ data: { session: { user: { id: 'me' } } }, error: null }),
    },
    getChannels: () => [],
    channel: (topic: string) => {
      const entry = {
        topic,
        handlers: [] as { filter: { event: string; table: string }; cb: (p: unknown) => void }[],
        status: null as ((s: string) => void) | null,
      }
      state.channels.push(entry)
      const ch = {
        on: (_type: string, filter: { event: string; table: string }, cb: (p: unknown) => void) => {
          entry.handlers.push({ filter, cb })
          return ch
        },
        subscribe: (cb: (s: string) => void) => {
          entry.status = cb
          if (state.autoSubscribe) queueMicrotask(() => cb('SUBSCRIBED'))
          return ch
        },
      }
      return ch
    },
    removeChannel: () => Promise.resolve('ok'),
  }
  return { supabase }
})

vi.mock('../lib/storageCleanup', () => ({
  removeScreenshots: vi.fn(async () => {}),
}))

vi.mock('./useImageCompression', () => ({
  compressImage: vi.fn(async () => ({
    blob: new Blob(['x']),
    width: 10,
    height: 10,
    previewUrl: '',
  })),
}))

vi.mock('../lib/upload', () => ({
  uploadAttachment: vi.fn(async ({ bugId }: { bugId: string }) => ({
    id: 'att-1',
    bug_id: bugId,
    storage_path: `ws1/${bugId}/a.webp`,
    width: 10,
    height: 10,
    size_bytes: 1,
    created_at: '2026-01-01T00:00:00Z',
  })),
}))

function bug(p: Partial<BugWithMeta>): BugWithMeta {
  return {
    id: 'b',
    workspace_id: 'ws1',
    number: 1,
    title: 'Title',
    description: '',
    transcript: null,
    severity: 'medium',
    status: 'open',
    kind: 'bug',
    filed_by: 'u1',
    created_at: '2026-01-01T00:00:00Z',
    resolved_by: null,
    resolved_at: null,
    resolution_note: null,
    assignee_id: null,
    updated_at: '2026-01-01T00:00:00Z',
    attachments: [],
    ...p,
  }
}

const BASE = {
  kind: 'bug',
  tab: 'all',
  filedBy: null,
  resolvedBy: null,
  assignee: null,
  severity: null,
  query: '',
  sort: 'newest',
} as const

const sample = [
  bug({ id: 'a', number: 12, title: 'Login button broken', filed_by: 'u1', severity: 'high' }),
  bug({
    id: 'b',
    number: 3,
    title: 'Crash',
    description: 'App crashes on Save',
    status: 'resolved',
    resolved_by: 'u2',
    filed_by: 'u2',
    severity: 'critical',
  }),
  bug({ id: 'c', number: 120, title: 'Typo', transcript: 'the HEADER says helo', filed_by: 'u1' }),
]

const ids = (list: BugWithMeta[]) => list.map((b) => b.id)

describe('sortBugs', () => {
  const list = [
    bug({ id: 'a', severity: 'low', created_at: '2026-01-01T00:00:00Z' }),
    bug({ id: 'b', severity: 'critical', created_at: '2026-01-02T00:00:00Z' }),
    bug({
      id: 'c',
      severity: 'critical',
      created_at: '2026-01-03T00:00:00Z',
      updated_at: '2026-01-03T00:00:00Z',
    }),
    bug({
      id: 'd',
      severity: 'high',
      created_at: '2026-01-01T12:00:00Z',
      updated_at: '2026-01-09T00:00:00Z',
    }),
  ]
  it('sorts newest and oldest by creation', () => {
    expect(ids(sortBugs(list, 'newest'))).toEqual(['c', 'b', 'd', 'a'])
    expect(ids(sortBugs(list, 'oldest'))).toEqual(['a', 'd', 'b', 'c'])
  })
  it('sorts by severity, then newest', () => {
    expect(ids(sortBugs(list, 'severity'))).toEqual(['c', 'b', 'd', 'a'])
  })
  it('sorts by latest of created, updated and resolved', () => {
    const withResolved = [...list, bug({ id: 'e', resolved_at: '2026-02-01T00:00:00Z' })]
    expect(ids(sortBugs(withResolved, 'activity'))).toEqual(['e', 'd', 'c', 'b', 'a'])
  })
  it('is stable for ties and does not mutate the input', () => {
    const ties = [bug({ id: 'x' }), bug({ id: 'y' }), bug({ id: 'z' })]
    for (const mode of ['newest', 'oldest', 'severity', 'activity'] as const)
      expect(ids(sortBugs(ties, mode))).toEqual(['x', 'y', 'z'])
    expect(ids(list)).toEqual(['a', 'b', 'c', 'd'])
  })
})

describe('filterBugs', () => {
  it('filters by tab', () => {
    expect(ids(filterBugs(sample, { ...BASE, tab: 'open' }))).toEqual(['a', 'c'])
    expect(ids(filterBugs(sample, { ...BASE, tab: 'resolved' }))).toEqual(['b'])
    expect(ids(filterBugs(sample, { ...BASE, tab: 'all' }))).toEqual(['a', 'b', 'c'])
  })

  it('filters by filedBy, resolvedBy and severity', () => {
    expect(ids(filterBugs(sample, { ...BASE, filedBy: 'u1' }))).toEqual(['a', 'c'])
    expect(ids(filterBugs(sample, { ...BASE, resolvedBy: 'u2' }))).toEqual(['b'])
    expect(ids(filterBugs(sample, { ...BASE, severity: 'critical' }))).toEqual(['b'])
    expect(ids(filterBugs(sample, { ...BASE, severity: 'low' }))).toEqual([])
  })

  it('searches title, description and transcript case-insensitively', () => {
    expect(ids(filterBugs(sample, { ...BASE, query: 'LOGIN' }))).toEqual(['a'])
    expect(ids(filterBugs(sample, { ...BASE, query: 'on save' }))).toEqual(['b'])
    expect(ids(filterBugs(sample, { ...BASE, query: 'header' }))).toEqual(['c'])
    expect(ids(filterBugs(sample, { ...BASE, query: '   ' }))).toEqual(['a', 'b', 'c'])
  })

  it('matches #<number> exactly', () => {
    expect(ids(filterBugs(sample, { ...BASE, query: '#12' }))).toEqual(['a'])
    expect(ids(filterBugs(sample, { ...BASE, query: '#3' }))).toEqual(['b'])
    expect(ids(filterBugs(sample, { ...BASE, query: '#99' }))).toEqual([])
  })

  it('filters by assignee: null = anyone, none = unassigned, else that user', () => {
    const assigned = [
      bug({ id: 'x', assignee_id: 'u1' }),
      bug({ id: 'y', assignee_id: null }),
      bug({ id: 'z', assignee_id: 'u2' }),
    ]
    expect(ids(filterBugs(assigned, { ...BASE, assignee: null }))).toEqual(['x', 'y', 'z'])
    expect(ids(filterBugs(assigned, { ...BASE, assignee: 'none' }))).toEqual(['y'])
    expect(ids(filterBugs(assigned, { ...BASE, assignee: 'u2' }))).toEqual(['z'])
    expect(ids(filterBugs(assigned, { ...BASE, assignee: 'u3' }))).toEqual([])
    expect(ids(filterBugs(assigned, { ...BASE, assignee: 'u1', tab: 'resolved' }))).toEqual([])
  })

  it('combines filters', () => {
    expect(ids(filterBugs(sample, { ...BASE, tab: 'open', filedBy: 'u1', query: 'typo' }))).toEqual(
      ['c'],
    )
  })
})

describe('counts', () => {
  it('counts open / resolved / all', () => {
    expect(countBugs(sample)).toEqual({ open: 2, resolved: 1, all: 3 })
    expect(countBugs([])).toEqual({ open: 0, resolved: 0, all: 0 })
  })

  it('counts one kind only when asked', () => {
    const mixed = [...sample, bug({ id: 'f', kind: 'feature' })]
    expect(countBugs(mixed, 'bug')).toEqual({ open: 2, resolved: 1, all: 3 })
    expect(countBugs(mixed, 'feature')).toEqual({ open: 1, resolved: 0, all: 1 })
  })
})

describe('filterBugs by kind', () => {
  it('shows only the selected kind, even for a #number search', () => {
    const mixed = [...sample, bug({ id: 'f', number: 7, kind: 'feature' })]
    expect(ids(filterBugs(mixed, BASE))).toEqual(['a', 'b', 'c'])
    expect(ids(filterBugs(mixed, { ...BASE, kind: 'feature' }))).toEqual(['f'])
    expect(ids(filterBugs(mixed, { ...BASE, query: '#7' }))).toEqual([])
  })
})

describe('useBugs', () => {
  beforeEach(() => {
    h.state.selectResult = { data: [], error: null }
    h.state.insertResult = { data: null, error: null }
    h.state.inserted = []
    h.state.deferInsert = false
    h.state.resolveInsert = null
    h.state.channels = []
    h.state.selectCalls = 0
    h.state.autoSubscribe = true
    h.state.updateResult = { error: null }
    h.state.deferUpdate = false
    h.state.resolveUpdate = null
    h.state.updated = []
    h.state.deferSelect = false
    h.state.resolveSelect = null
    resetPendingUploads()
    URL.createObjectURL = vi.fn(() => 'blob:preview')
    URL.revokeObjectURL = vi.fn()
  })
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('loads bugs, exposes counts and subscribes to ws:<id>:bugs', async () => {
    h.state.selectResult = {
      data: [
        { ...bug({ id: 'x', status: 'open' }), bug_attachments: [] },
        { ...bug({ id: 'y', status: 'resolved' }), bug_attachments: [] },
      ],
      error: null,
    }
    const { result } = renderHook(() => useBugs('ws1'))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.counts).toEqual({ open: 1, resolved: 1, all: 2 })
    expect(h.state.channels.map((c) => c.topic)).toContain('ws:ws1:bugs')
  })

  it('fileBug retries without context when the server lacks the column (migration 0007 pending)', async () => {
    h.state.insertResult = { data: bug({ id: 'tmp', number: 9 }), error: null }
    h.state.insertFailOnce = {
      data: null,
      error: { code: 'PGRST204', message: "Could not find the 'context' column of 'bugs'" },
    } as unknown as Result
    const { result } = renderHook(() => useBugs('ws1'))
    await waitFor(() => expect(result.current.loading).toBe(false))
    await act(async () => {
      await result.current.fileBug({
        description: 'Old server',
        context: { browser: 'Chrome 131' },
        transcript: null,
        severity: 'low',
        kind: 'bug',
        files: [],
      })
    })
    expect(h.state.inserted).toHaveLength(2)
    expect((h.state.inserted[1] as { row: object }).row).not.toHaveProperty('context')
    expect(result.current.bugs[0].number).toBe(9)
  })

  it('fileBug inserts optimistically and clears the optimistic flag once the insert resolves', async () => {
    h.state.deferInsert = true
    const { result } = renderHook(() => useBugs('ws1'))
    await waitFor(() => expect(result.current.loading).toBe(false))

    let filing: Promise<void> = Promise.resolve()
    act(() => {
      filing = result.current.fileBug({
        description: 'Checkout total is wrong\nmore details',
        context: { url: 'https://example.com/checkout', browser: 'Chrome 131' },
        transcript: null,
        severity: 'high',
        kind: 'bug',
        files: [new File(['img'], 'a.png', { type: 'image/png' })],
      })
    })
    await waitFor(() => expect(result.current.bugs).toHaveLength(1))
    const optimistic = result.current.bugs[0]
    expect(optimistic.context).toEqual({
      url: 'https://example.com/checkout',
      browser: 'Chrome 131',
    })
    expect(h.state.inserted[0]).toMatchObject({ row: { context: optimistic.context } })
    expect(optimistic.optimistic).toBe(true)
    expect(optimistic.title).toBe('Checkout total is wrong')
    expect(optimistic.pending).toHaveLength(1)
    expect(optimistic.pending?.[0].previewUrl).toBe('blob:preview')
    const insertedRow = (h.state.inserted[0] as { row: { id: string; filed_by: string } }).row
    expect(insertedRow.id).toBe(optimistic.id)
    expect(insertedRow.filed_by).toBe('me')

    await act(async () => {
      h.state.resolveInsert?.({
        data: { ...bug({ id: optimistic.id, number: 7, title: optimistic.title }) },
        error: null,
      })
      await filing
    })
    await waitFor(() => expect(result.current.bugs[0].attachments).toHaveLength(1))
    const saved = result.current.bugs[0]
    expect(saved.optimistic).toBe(false)
    expect(saved.number).toBe(7)
    expect(saved.pending).toBeUndefined()
  })

  it('fileBug removes the optimistic row and throws a friendly error when rate limited', async () => {
    h.state.insertResult = { data: null, error: { message: 'rate_limited' } }
    const { result } = renderHook(() => useBugs('ws1'))
    await waitFor(() => expect(result.current.loading).toBe(false))

    let caught: unknown = null
    await act(async () => {
      try {
        await result.current.fileBug({
          description: 'x',
          transcript: null,
          severity: 'low',
          kind: 'bug',
          files: [],
        })
      } catch (err) {
        caught = err
      }
    })
    expect(caught).toBeInstanceOf(Error)
    expect((caught as Error).message).toBe('Slow down — max 30 bugs per minute.')
    expect(result.current.bugs).toHaveLength(0)
  })

  it('announces remote inserts from other users only', async () => {
    const onRemoteInsert = vi.fn()
    const { result } = renderHook(() => useBugs('ws1', { onRemoteInsert }))
    await waitFor(() => expect(result.current.loading).toBe(false))
    const ch = h.state.channels.find((c) => c.topic === 'ws:ws1:bugs')
    const insert = ch?.handlers.find(
      (x) => x.filter.table === 'bugs' && x.filter.event === 'INSERT',
    )
    act(() => {
      insert?.cb({ new: bug({ id: 'r1', filed_by: 'other' }) })
      insert?.cb({ new: bug({ id: 'r2', filed_by: 'me', created_at: '2026-01-02T00:00:00Z' }) })
    })
    expect(onRemoteInsert).toHaveBeenCalledTimes(1)
    expect(onRemoteInsert.mock.calls[0][0].id).toBe('r1')
    expect(ids(result.current.bugs)).toEqual(['r2', 'r1'])
  })
})

function handler(table: string, event: string) {
  const ch = h.state.channels.find((c) => c.topic === 'ws:ws1:bugs')
  const found = ch?.handlers.find((x) => x.filter.table === table && x.filter.event === event)
  if (!found) throw new Error(`no handler for ${table} ${event}`)
  return found.cb
}

const att = (id: string, bugId: string) => ({
  id,
  bug_id: bugId,
  storage_path: `ws1/${bugId}/${id}.webp`,
  width: 1,
  height: 1,
  size_bytes: 1,
  created_at: '2026-01-01T00:00:00Z',
})

describe('applySnapshot', () => {
  const none = { truncated: false, isRecent: () => false }

  it('replaces attachments with the snapshot and drops vanished non-optimistic bugs', () => {
    const current = [
      bug({ id: 'a', attachments: [att('old', 'a')] }),
      bug({ id: 'gone' }),
      bug({ id: 'opt', optimistic: true }),
    ]
    const next = applySnapshot(current, [bug({ id: 'a', attachments: [att('new', 'a')] })], none)
    expect(ids(next).sort()).toEqual(['a', 'opt'])
    expect(next.find((b) => b.id === 'a')?.attachments.map((x) => x.id)).toEqual(['new'])
  })

  it('keeps changes seen after the fetch started and rows outside a truncated window', () => {
    const current = [
      bug({ id: 'a', attachments: [att('live', 'a'), att('deleted', 'a')] }),
      bug({ id: 'fresh', created_at: '2026-03-01T00:00:00Z' }),
      bug({ id: 'ancient', created_at: '2020-01-01T00:00:00Z' }),
    ]
    const recent = new Set(['att:live', 'bug:fresh', 'del:deleted'])
    const next = applySnapshot(current, [bug({ id: 'a', attachments: [att('deleted', 'a')] })], {
      truncated: true,
      isRecent: (k) => recent.has(k),
    })
    expect(ids(next)).toEqual(['fresh', 'a', 'ancient'])
    expect(next.find((b) => b.id === 'a')?.attachments.map((x) => x.id)).toEqual(['live'])
  })

  it('never moves a row backwards in time', () => {
    const current = [bug({ id: 'a', title: 'New', updated_at: '2026-02-01T00:00:00Z' })]
    const next = applySnapshot(
      current,
      [bug({ id: 'a', title: 'Old', updated_at: '2026-01-01T00:00:00Z' })],
      none,
    )
    expect(next[0].title).toBe('New')
  })
})

describe('useBugs sync', () => {
  it('exposes a load error and reloads successfully without reconnecting realtime', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    h.state.selectResult = { data: null, error: { message: 'Unavailable' } }
    const { result } = renderHook(() => useBugs('ws1'))
    await waitFor(() => expect(result.current.error).toBe("Couldn't load bugs"))
    expect(result.current.loading).toBe(false)
    expect(h.state.selectCalls).toBe(1)
    h.state.selectResult = {
      data: [{ ...bug({ id: 'recovered' }), bug_attachments: [] }],
      error: null,
    }
    act(() => result.current.reload())
    expect(result.current.error).toBeNull()
    expect(result.current.loading).toBe(true)
    await waitFor(() => expect(ids(result.current.bugs)).toEqual(['recovered']))
    expect(result.current.error).toBeNull()
    expect(result.current.loading).toBe(false)
    expect(h.state.selectCalls).toBe(2)
    expect(h.state.channels).toHaveLength(1)
    log.mockRestore()
  })

  beforeEach(() => {
    h.state.selectResult = { data: [], error: null }
    h.state.insertResult = { data: null, error: null }
    h.state.inserted = []
    h.state.deferInsert = false
    h.state.resolveInsert = null
    h.state.channels = []
    h.state.selectCalls = 0
    h.state.autoSubscribe = true
    h.state.updateResult = { error: null }
    h.state.deferUpdate = false
    h.state.resolveUpdate = null
    h.state.updated = []
    h.state.deferSelect = false
    h.state.resolveSelect = null
    h.state.deleteResult = { data: [{ id: 'x' }], error: null }
    h.state.deleted = []
    resetPendingUploads()
    URL.createObjectURL = vi.fn(() => 'blob:preview')
    URL.revokeObjectURL = vi.fn()
  })
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('deleteBug deletes the row, drops it from the list, then removes its screenshots', async () => {
    h.state.selectResult = {
      data: [
        { ...bug({ id: 'x' }), bug_attachments: [] },
        { ...bug({ id: 'y' }), bug_attachments: [] },
      ],
      error: null,
    }
    const { result } = renderHook(() => useBugs('ws1'))
    await waitFor(() => expect(ids(result.current.bugs)).toEqual(['x', 'y']))
    await act(async () => result.current.deleteBug('x'))
    expect(h.state.deleted).toEqual(['x'])
    expect(ids(result.current.bugs)).toEqual(['y'])
    expect(removeScreenshots).toHaveBeenCalledWith('ws1/x')
  })

  it('deleteBug keeps the bug and its screenshots when the delete is refused', async () => {
    h.state.selectResult = { data: [{ ...bug({ id: 'x' }), bug_attachments: [] }], error: null }
    const { result } = renderHook(() => useBugs('ws1'))
    await waitFor(() => expect(ids(result.current.bugs)).toEqual(['x']))
    // RLS without a delete policy matches no rows instead of erroring.
    h.state.deleteResult = { data: [], error: null }
    await act(async () => {
      await expect(result.current.deleteBug('x')).rejects.toThrow(/Could not delete/)
    })
    expect(ids(result.current.bugs)).toEqual(['x'])
    expect(removeScreenshots).not.toHaveBeenCalled()
  })

  it('drops bugs deleted remotely, even from a fetch that was already in flight', async () => {
    h.state.selectResult = {
      data: [
        { ...bug({ id: 'x' }), bug_attachments: [] },
        { ...bug({ id: 'y' }), bug_attachments: [] },
      ],
      error: null,
    }
    const { result } = renderHook(() => useBugs('ws1'))
    await waitFor(() => expect(ids(result.current.bugs)).toEqual(['x', 'y']))

    h.state.deferSelect = true
    const status = h.state.channels.find((c) => c.topic === 'ws:ws1:bugs')?.status
    await act(async () => status?.('SUBSCRIBED'))
    act(() => handler('bugs', 'DELETE')({ old: { id: 'x' } }))
    expect(ids(result.current.bugs)).toEqual(['y'])
    // The stale snapshot still contains x, and so does a late UPDATE event.
    await act(async () => h.state.resolveSelect?.(h.state.selectResult))
    act(() =>
      handler('bugs', 'UPDATE')({ new: bug({ id: 'x', updated_at: '2026-09-01T00:00:00Z' }) }),
    )
    expect(ids(result.current.bugs)).toEqual(['y'])
  })

  it('fetches only once subscribed, and again on every re-subscribe', async () => {
    h.state.autoSubscribe = false
    h.state.selectResult = { data: [{ ...bug({ id: 'x' }), bug_attachments: [] }], error: null }
    const { result } = renderHook(() => useBugs('ws1'))
    await act(async () => {})
    expect(h.state.selectCalls).toBe(0)
    expect(result.current.loading).toBe(true)

    const status = h.state.channels.find((c) => c.topic === 'ws:ws1:bugs')?.status
    await act(async () => status?.('SUBSCRIBED'))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(ids(result.current.bugs)).toEqual(['x'])

    h.state.selectResult = { data: [{ ...bug({ id: 'y' }), bug_attachments: [] }], error: null }
    await act(async () => status?.('CHANNEL_ERROR'))
    await act(async () => status?.('SUBSCRIBED'))
    await waitFor(() => expect(ids(result.current.bugs)).toEqual(['y']))
    expect(h.state.selectCalls).toBe(2)
  })

  it('does not let the insert response overwrite a newer realtime UPDATE', async () => {
    h.state.deferInsert = true
    const { result } = renderHook(() => useBugs('ws1'))
    await waitFor(() => expect(result.current.loading).toBe(false))
    let filing: Promise<void> = Promise.resolve()
    act(() => {
      filing = result.current.fileBug({
        description: 'Original',
        transcript: null,
        severity: 'low',
        kind: 'bug',
        files: [],
      })
    })
    await waitFor(() => expect(result.current.bugs).toHaveLength(1))
    const id = result.current.bugs[0].id
    act(() => {
      handler(
        'bugs',
        'UPDATE',
      )({
        new: bug({ id, number: 4, title: 'Edited remotely', updated_at: '2026-05-01T00:00:00Z' }),
      })
    })
    await act(async () => {
      h.state.resolveInsert?.({
        data: bug({ id, number: 4, title: 'Original', updated_at: '2026-04-01T00:00:00Z' }),
        error: null,
      })
      await filing
    })
    expect(result.current.bugs[0].title).toBe('Edited remotely')
    expect(result.current.bugs[0].optimistic).toBe(false)
  })

  it('assignBug patches assignee_id optimistically and reverts on error', async () => {
    h.state.selectResult = {
      data: [{ ...bug({ id: 'a', assignee_id: 'u1' }), bug_attachments: [] }],
      error: null,
    }
    const { result } = renderHook(() => useBugs('ws1'))
    await waitFor(() => expect(result.current.loading).toBe(false))

    h.state.deferUpdate = true
    let pending: Promise<void> = Promise.resolve()
    act(() => {
      pending = result.current.assignBug('a', 'u2')
    })
    expect(result.current.bugs[0].assignee_id).toBe('u2')
    expect(h.state.updated).toEqual([{ table: 'bugs', patch: { assignee_id: 'u2' } }])
    await act(async () => {
      h.state.resolveUpdate?.({ error: null })
      await pending
    })
    expect(result.current.bugs[0].assignee_id).toBe('u2')

    h.state.deferUpdate = false
    h.state.updateResult = { error: { message: 'assignee_not_member' } }
    await act(async () => {
      await expect(result.current.assignBug('a', 'u3')).rejects.toThrow(
        'That person is not a member of this workspace.',
      )
    })
    expect(result.current.bugs[0].assignee_id).toBe('u2')
    expect(h.state.updated[1]).toEqual({ table: 'bugs', patch: { assignee_id: 'u3' } })

    h.state.updateResult = { error: null }
    await act(async () => {
      await result.current.assignBug('a', null)
    })
    expect(result.current.bugs[0].assignee_id).toBeNull()
    expect(h.state.updated[2]).toEqual({ table: 'bugs', patch: { assignee_id: null } })
  })

  it('reverts a failed update unless a newer server row arrived meanwhile', async () => {
    h.state.selectResult = {
      data: [
        { ...bug({ id: 'a', title: 'A' }), bug_attachments: [] },
        {
          ...bug({ id: 'b', title: 'B', created_at: '2025-12-01T00:00:00Z' }),
          bug_attachments: [],
        },
      ],
      error: null,
    }
    h.state.updateResult = { error: { message: 'boom' } }
    const { result } = renderHook(() => useBugs('ws1'))
    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => {
      await expect(result.current.updateBug('a', { title: 'A2' })).rejects.toThrow('boom')
    })
    expect(result.current.bugs.find((b) => b.id === 'a')?.title).toBe('A')

    h.state.deferUpdate = true
    let pending: Promise<void> = Promise.resolve()
    act(() => {
      pending = result.current.updateBug('b', { title: 'B2' })
    })
    expect(result.current.bugs.find((b) => b.id === 'b')?.title).toBe('B2')
    act(() => {
      handler(
        'bugs',
        'UPDATE',
      )({
        new: bug({
          id: 'b',
          title: 'B server',
          created_at: '2025-12-01T00:00:00Z',
          updated_at: '2026-06-01T00:00:00Z',
        }),
      })
    })
    await act(async () => {
      h.state.resolveUpdate?.({ error: { message: 'boom' } })
      await expect(pending).rejects.toThrow('boom')
    })
    expect(result.current.bugs.find((b) => b.id === 'b')?.title).toBe('B server')
  })

  it('concurrent retryUploads never upload the same file twice', async () => {
    const upload = vi.mocked(uploadAttachment)
    upload.mockRejectedValueOnce(new Error('network down'))
    h.state.insertResult = { data: bug({ id: 'tmp' }), error: null }
    const { result } = renderHook(() => useBugs('ws1'))
    await waitFor(() => expect(result.current.loading).toBe(false))
    await act(async () => {
      await result.current.fileBug({
        description: 'With screenshot',
        transcript: null,
        severity: 'low',
        kind: 'bug',
        files: [new File(['img'], 'a.png', { type: 'image/png' })],
      })
    })
    await waitFor(() => expect(result.current.bugs[0].pending?.[0].error).toBe('network down'))
    const id = result.current.bugs[0].id
    expect(upload).toHaveBeenCalledTimes(1)

    await act(async () => {
      await Promise.all([result.current.retryUploads(id), result.current.retryUploads(id)])
    })
    expect(upload).toHaveBeenCalledTimes(2)
    expect(result.current.bugs).toHaveLength(1)
    expect(result.current.bugs[0].pending).toBeUndefined()
    expect(result.current.bugs[0].attachments).toHaveLength(1)
  })

  it('keeps failed uploads across a workspace switch', async () => {
    vi.mocked(uploadAttachment).mockRejectedValueOnce(new Error('network down'))
    h.state.insertResult = { data: bug({ id: 'tmp' }), error: null }
    const { result, rerender } = renderHook(({ ws }) => useBugs(ws), {
      initialProps: { ws: 'ws1' },
    })
    await waitFor(() => expect(result.current.loading).toBe(false))
    await act(async () => {
      await result.current.fileBug({
        description: 'x',
        transcript: null,
        severity: 'low',
        kind: 'bug',
        files: [new File(['img'], 'a.png', { type: 'image/png' })],
      })
    })
    await waitFor(() => expect(result.current.bugs[0].pending?.[0].error).toBe('network down'))
    const id = result.current.bugs[0].id
    rerender({ ws: 'ws2' })
    await waitFor(() => expect(result.current.loading).toBe(false))
    h.state.selectResult = { data: [{ ...bug({ id }), bug_attachments: [] }], error: null }
    rerender({ ws: 'ws1' })
    await waitFor(() => expect(result.current.bugs[0]?.pending?.[0].error).toBe('network down'))
  })

  // These run in order: the last leaves the module remembering the missing column.
  const markupInput = (description: string) => {
    const flattened = new File(['flat'], 'a-marked.png', { type: 'image/png' })
    const original = new File(['orig'], 'a.png', { type: 'image/png' })
    const annotations = {
      v: 1 as const,
      shapes: [{ type: 'pin' as const, color: 'danger' as const, n: 1, x: 0.5, y: 0.5 }],
    }
    return {
      flattened,
      original,
      annotations,
      input: {
        description,
        transcript: null,
        severity: 'low' as const,
        kind: 'bug' as const,
        files: [flattened, new File(['plain'], 'b.png', { type: 'image/png' })],
        markup: [{ original, annotations }, null],
      },
    }
  }

  it('uploads a marked-up screenshot as the unmarked original plus its annotations', async () => {
    h.state.insertResult = { data: bug({ id: 'tmp' }), error: null }
    const { result } = renderHook(() => useBugs('ws1'))
    await waitFor(() => expect(result.current.loading).toBe(false))
    const { original, annotations, input } = markupInput('Marked')
    await act(async () => {
      await result.current.fileBug(input)
    })
    await waitFor(() => expect(vi.mocked(uploadAttachment)).toHaveBeenCalledTimes(2))
    expect(vi.mocked(compressImage).mock.calls.map((c) => c[0])).toEqual([original, input.files[1]])
    expect(vi.mocked(uploadAttachment).mock.calls[0][0].annotations).toEqual(annotations)
    expect(vi.mocked(uploadAttachment).mock.calls[1][0].annotations).toBeUndefined()
  })

  it('reports other upload errors on a marked-up screenshot without falling back', async () => {
    const upload = vi.mocked(uploadAttachment)
    upload.mockRejectedValueOnce(new Error('network down'))
    h.state.insertResult = { data: bug({ id: 'tmp' }), error: null }
    const { result } = renderHook(() => useBugs('ws1'))
    await waitFor(() => expect(result.current.loading).toBe(false))
    const { input } = markupInput('Flaky')
    await act(async () => {
      await result.current.fileBug({ ...input, files: [input.files[0]], markup: [input.markup[0]] })
    })
    await waitFor(() => expect(result.current.bugs[0].pending?.[0].error).toBe('network down'))
    expect(upload).toHaveBeenCalledTimes(1)
  })

  it('falls back to the flattened image when the annotations column is missing', async () => {
    const upload = vi.mocked(uploadAttachment)
    upload.mockRejectedValueOnce({
      code: 'PGRST204',
      message: "Could not find the 'annotations' column of 'bug_attachments' in the schema cache",
    })
    h.state.insertResult = { data: bug({ id: 'tmp' }), error: null }
    const { result } = renderHook(() => useBugs('ws1'))
    await waitFor(() => expect(result.current.loading).toBe(false))
    const first = markupInput('Old server')
    await act(async () => {
      await result.current.fileBug(first.input)
    })
    await waitFor(() => expect(upload).toHaveBeenCalledTimes(3))
    expect(vi.mocked(compressImage).mock.calls.map((c) => c[0])).toEqual([
      first.original,
      first.flattened,
      first.input.files[1],
    ])
    expect(upload.mock.calls[1][0].annotations).toBeUndefined()
    await waitFor(() => expect(result.current.bugs[0].pending).toBeUndefined())

    // Once known, later marked-up screenshots upload flattened straight away.
    upload.mockClear()
    vi.mocked(compressImage).mockClear()
    const second = markupInput('Old server again')
    await act(async () => {
      await result.current.fileBug(second.input)
    })
    await waitFor(() => expect(upload).toHaveBeenCalledTimes(2))
    expect(vi.mocked(compressImage).mock.calls[0][0]).toBe(second.flattened)
    expect(upload.mock.calls.every((c) => c[0].annotations === undefined)).toBe(true)
  })

  it('a failed update does not clobber a later optimistic edit of the same field', async () => {
    h.state.selectResult = {
      data: [{ ...bug({ id: 'a', title: 'Orig' }), bug_attachments: [] }],
      error: null,
    }
    h.state.deferUpdate = true
    const { result } = renderHook(() => useBugs('ws1'))
    await waitFor(() => expect(result.current.loading).toBe(false))

    let first: Promise<void> = Promise.resolve()
    act(() => {
      first = result.current.updateBug('a', { title: 'T1' })
    })
    const resolveFirst = h.state.resolveUpdate
    let second: Promise<void> = Promise.resolve()
    act(() => {
      second = result.current.updateBug('a', { title: 'T2' })
    })
    const resolveSecond = h.state.resolveUpdate
    expect(result.current.bugs[0].title).toBe('T2')

    await act(async () => {
      resolveFirst?.({ error: { message: 'boom' } })
      await expect(first).rejects.toThrow('boom')
    })
    expect(result.current.bugs[0].title).toBe('T2')

    await act(async () => {
      resolveSecond?.({ error: { message: 'boom' } })
      await expect(second).rejects.toThrow('boom')
    })
    expect(result.current.bugs[0].title).toBe('Orig')
  })

  it('delivers an upload that finishes after a remount to the mounted hook', async () => {
    let finish: (a: ReturnType<typeof att>) => void = () => {}
    vi.mocked(uploadAttachment).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve
        }),
    )
    h.state.insertResult = { data: bug({ id: 'tmp' }), error: null }
    const first = renderHook(() => useBugs('ws1'))
    await waitFor(() => expect(first.result.current.loading).toBe(false))
    await act(async () => {
      await first.result.current.fileBug({
        description: 'x',
        transcript: null,
        severity: 'low',
        kind: 'bug',
        files: [new File(['img'], 'a.png', { type: 'image/png' })],
      })
    })
    const id = first.result.current.bugs[0].id
    await waitFor(() => expect(vi.mocked(uploadAttachment)).toHaveBeenCalledTimes(1))
    first.unmount()

    h.state.selectResult = { data: [{ ...bug({ id }), bug_attachments: [] }], error: null }
    const second = renderHook(() => useBugs('ws1'))
    await waitFor(() => expect(second.result.current.loading).toBe(false))
    expect(second.result.current.bugs[0].pending).toHaveLength(1)

    await act(async () => {
      finish(att('late', id))
    })
    await waitFor(() => expect(second.result.current.bugs[0].attachments).toHaveLength(1))
    expect(second.result.current.bugs[0].attachments[0].id).toBe('late')
    expect(second.result.current.bugs[0].pending).toBeUndefined()
  })

  it('a failed later edit falls back to an earlier edit that is still outstanding', async () => {
    h.state.selectResult = {
      data: [{ ...bug({ id: 'a', title: 'Orig' }), bug_attachments: [] }],
      error: null,
    }
    h.state.deferUpdate = true
    const { result } = renderHook(() => useBugs('ws1'))
    await waitFor(() => expect(result.current.loading).toBe(false))

    for (const firstOutcome of ['ok', 'boom'] as const) {
      let first: Promise<void> = Promise.resolve()
      act(() => {
        first = result.current.updateBug('a', { title: `T1-${firstOutcome}` })
      })
      const resolveFirst = h.state.resolveUpdate
      let second: Promise<void> = Promise.resolve()
      act(() => {
        second = result.current.updateBug('a', { title: 'T2' })
      })
      const resolveSecond = h.state.resolveUpdate
      // Second round starts from the value confirmed in the first.
      const original = firstOutcome === 'ok' ? 'Orig' : 'T1-ok'

      await act(async () => {
        resolveSecond?.({ error: { message: 'boom' } })
        await expect(second).rejects.toThrow('boom')
      })
      expect(result.current.bugs[0].title).toBe(`T1-${firstOutcome}`)

      await act(async () => {
        if (firstOutcome === 'ok') {
          resolveFirst?.({ error: null })
          await first
        } else {
          resolveFirst?.({ error: { message: 'boom' } })
          await expect(first).rejects.toThrow('boom')
        }
      })
      expect(result.current.bugs[0].title).toBe(firstOutcome === 'ok' ? 'T1-ok' : original)
    }
  })

  it('a later edit failing after an earlier one succeeded shows the confirmed value', async () => {
    h.state.selectResult = {
      data: [{ ...bug({ id: 'a', title: 'Orig' }), bug_attachments: [] }],
      error: null,
    }
    h.state.deferUpdate = true
    const { result } = renderHook(() => useBugs('ws1'))
    await waitFor(() => expect(result.current.loading).toBe(false))

    let first: Promise<void> = Promise.resolve()
    act(() => {
      first = result.current.updateBug('a', { title: 'T1' })
    })
    const resolveFirst = h.state.resolveUpdate
    let second: Promise<void> = Promise.resolve()
    act(() => {
      second = result.current.updateBug('a', { title: 'T2' })
    })
    const resolveSecond = h.state.resolveUpdate

    await act(async () => {
      resolveFirst?.({ error: null })
      await first
    })
    expect(result.current.bugs[0].title).toBe('T2')

    await act(async () => {
      resolveSecond?.({ error: { message: 'boom' } })
      await expect(second).rejects.toThrow('boom')
    })
    expect(result.current.bugs[0].title).toBe('T1')
  })

  it('keeps an upload that completes while the initial fetch is in flight', async () => {
    let finish: (a: ReturnType<typeof att>) => void = () => {}
    vi.mocked(uploadAttachment).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve
        }),
    )
    h.state.insertResult = { data: bug({ id: 'tmp' }), error: null }
    const first = renderHook(() => useBugs('ws1'))
    await waitFor(() => expect(first.result.current.loading).toBe(false))
    await act(async () => {
      await first.result.current.fileBug({
        description: 'x',
        transcript: null,
        severity: 'low',
        kind: 'bug',
        files: [new File(['img'], 'a.png', { type: 'image/png' })],
      })
    })
    const id = first.result.current.bugs[0].id
    await waitFor(() => expect(vi.mocked(uploadAttachment)).toHaveBeenCalledTimes(1))
    first.unmount()

    h.state.deferSelect = true
    const second = renderHook(() => useBugs('ws1'))
    await waitFor(() => expect(h.state.resolveSelect).not.toBeNull())
    expect(second.result.current.loading).toBe(true)

    await act(async () => {
      finish(att('early', id))
    })
    await act(async () => {
      // The fetch started before the upload finished, so its snapshot lacks the attachment.
      h.state.resolveSelect?.({ data: [{ ...bug({ id }), bug_attachments: [] }], error: null })
    })
    await waitFor(() => expect(second.result.current.loading).toBe(false))
    expect(second.result.current.bugs[0].attachments.map((a) => a.id)).toEqual(['early'])
    expect(second.result.current.bugs[0].pending).toBeUndefined()
    expect(retainedUploadCount('ws1')).toBe(0)

    // A later fetch that started after the completion is authoritative again.
    h.state.deferSelect = false
    h.state.selectResult = {
      data: [{ ...bug({ id }), bug_attachments: [att('early', id)] }],
      error: null,
    }
    const status = h.state.channels.filter((c) => c.topic === 'ws:ws1:bugs').at(-1)?.status
    await act(async () => status?.('SUBSCRIBED'))
    await waitFor(() => expect(h.state.selectCalls).toBeGreaterThanOrEqual(3))
    expect(second.result.current.bugs[0].attachments.map((a) => a.id)).toEqual(['early'])
  })

  it('retains nothing for an upload that completes with no fetch in flight', async () => {
    h.state.insertResult = { data: bug({ id: 'tmp' }), error: null }
    const { result } = renderHook(() => useBugs('ws1'))
    await waitFor(() => expect(result.current.loading).toBe(false))
    await act(async () => {
      await result.current.fileBug({
        description: 'x',
        transcript: null,
        severity: 'low',
        kind: 'bug',
        files: [new File(['img'], 'a.png', { type: 'image/png' })],
      })
    })
    await waitFor(() => expect(result.current.bugs[0].attachments).toHaveLength(1))
    expect(retainedUploadCount('ws1')).toBe(0)
  })

  it('clears retained uploads when the last hook for the workspace unmounts', async () => {
    let finish: (a: ReturnType<typeof att>) => void = () => {}
    vi.mocked(uploadAttachment).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve
        }),
    )
    h.state.insertResult = { data: bug({ id: 'tmp' }), error: null }
    const first = renderHook(() => useBugs('ws1'))
    await waitFor(() => expect(first.result.current.loading).toBe(false))
    await act(async () => {
      await first.result.current.fileBug({
        description: 'x',
        transcript: null,
        severity: 'low',
        kind: 'bug',
        files: [new File(['img'], 'a.png', { type: 'image/png' })],
      })
    })
    const id = first.result.current.bugs[0].id
    await waitFor(() => expect(vi.mocked(uploadAttachment)).toHaveBeenCalledTimes(1))

    h.state.deferSelect = true
    const second = renderHook(() => useBugs('ws1'))
    await waitFor(() => expect(h.state.resolveSelect).not.toBeNull())
    await act(async () => {
      finish(att('held', id))
    })
    expect(retainedUploadCount('ws1')).toBe(1)

    first.unmount()
    expect(retainedUploadCount('ws1')).toBe(1)
    second.unmount()
    expect(retainedUploadCount('ws1')).toBe(0)
  })

  it('retains nothing for an upload completing after the last hook unmounted', async () => {
    let finish: (a: ReturnType<typeof att>) => void = () => {}
    vi.mocked(uploadAttachment).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve
        }),
    )
    h.state.insertResult = { data: bug({ id: 'tmp' }), error: null }
    const first = renderHook(() => useBugs('ws1'))
    await waitFor(() => expect(first.result.current.loading).toBe(false))
    await act(async () => {
      await first.result.current.fileBug({
        description: 'x',
        transcript: null,
        severity: 'low',
        kind: 'bug',
        files: [new File(['img'], 'a.png', { type: 'image/png' })],
      })
    })
    const id = first.result.current.bugs[0].id
    await waitFor(() => expect(vi.mocked(uploadAttachment)).toHaveBeenCalledTimes(1))

    // A stalled fetch stays registered after its hook unmounts.
    h.state.deferSelect = true
    const second = renderHook(() => useBugs('ws1'))
    await waitFor(() => expect(h.state.resolveSelect).not.toBeNull())
    first.unmount()
    second.unmount()

    await act(async () => {
      finish(att('orphan', id))
    })
    expect(retainedUploadCount('ws1')).toBe(0)
  })
})
