import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { BugWithMeta } from '../lib/types'
import { countBugs, filterBugs, useBugs } from './useBugs'

type Result = { data: unknown; error: { message: string } | null }

const h = vi.hoisted(() => {
  const state = {
    selectResult: { data: [] as unknown[], error: null } as Result,
    insertResult: { data: null, error: null } as Result,
    inserted: [] as unknown[],
    resolveInsert: null as null | ((r: Result) => void),
    deferInsert: false,
    channels: [] as {
      topic: string
      handlers: { filter: { event: string; table: string }; cb: (p: unknown) => void }[]
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
      limit: () => Promise.resolve(state.selectResult),
      maybeSingle: () => Promise.resolve({ data: null, error: null }),
      insert: (row: unknown) => {
        state.inserted.push({ table, row })
        return {
          select: () => ({
            single: () =>
              state.deferInsert
                ? new Promise<Result>((resolve) => {
                    state.resolveInsert = resolve
                  })
                : Promise.resolve(state.insertResult),
          }),
        }
      },
      update: () => ({ eq: () => Promise.resolve({ error: null }) }),
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
      }
      state.channels.push(entry)
      const ch = {
        on: (_type: string, filter: { event: string; table: string }, cb: (p: unknown) => void) => {
          entry.handlers.push({ filter, cb })
          return ch
        },
        subscribe: () => ch,
      }
      return ch
    },
    removeChannel: () => Promise.resolve('ok'),
  }
  return { supabase }
})

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
    filed_by: 'u1',
    created_at: '2026-01-01T00:00:00Z',
    resolved_by: null,
    resolved_at: null,
    resolution_note: null,
    updated_at: '2026-01-01T00:00:00Z',
    attachments: [],
    ...p,
  }
}

const BASE = { tab: 'all', filedBy: null, resolvedBy: null, severity: null, query: '' } as const

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
})

describe('useBugs', () => {
  beforeEach(() => {
    h.state.selectResult = { data: [], error: null }
    h.state.insertResult = { data: null, error: null }
    h.state.inserted = []
    h.state.deferInsert = false
    h.state.resolveInsert = null
    h.state.channels = []
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

  it('fileBug inserts optimistically and clears the optimistic flag once the insert resolves', async () => {
    h.state.deferInsert = true
    const { result } = renderHook(() => useBugs('ws1'))
    await waitFor(() => expect(result.current.loading).toBe(false))

    let filing: Promise<void> = Promise.resolve()
    act(() => {
      filing = result.current.fileBug({
        description: 'Checkout total is wrong\nmore details',
        transcript: null,
        severity: 'high',
        files: [new File(['img'], 'a.png', { type: 'image/png' })],
      })
    })
    await waitFor(() => expect(result.current.bugs).toHaveLength(1))
    const optimistic = result.current.bugs[0]
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
