import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { FixRun } from '../lib/fixRuns'
import { mergeFixRuns, recordFixRun, useFixRuns } from './useFixRuns'

type Result = { data: unknown; error: { code?: string; message: string } | null }

const h = vi.hoisted(() => ({
  state: {
    load: { data: [], error: null } as Result,
    insert: { data: null, error: null } as Result,
    inserted: [] as unknown[],
    queries: [] as string[][],
    handlers: [] as { filter: { event: string; filter?: string }; cb: (p: unknown) => void }[],
    subscribed: 0,
    removed: 0,
    status: null as null | ((s: string) => void),
  },
}))

vi.mock('../lib/supabase', () => {
  const { state } = h
  const from = (table: string) => {
    const calls: string[] = [table]
    const builder = {
      select: () => builder,
      eq: (col: string, value: string) => {
        calls.push(`${col}=${value}`)
        return builder
      },
      order: (col: string, opts: { ascending: boolean }) => {
        calls.push(`order ${col} ${opts.ascending ? 'asc' : 'desc'}`)
        return builder
      },
      limit: (n: number) => {
        calls.push(`limit ${n}`)
        state.queries.push(calls)
        return Promise.resolve(state.load)
      },
      insert: (row: unknown) => {
        state.inserted.push(row)
        return { select: () => ({ single: () => Promise.resolve(state.insert) }) }
      },
    }
    return builder
  }
  const channel = {
    on: (_t: string, filter: { event: string; filter?: string }, cb: (p: unknown) => void) => {
      state.handlers.push({ filter, cb })
      return channel
    },
    subscribe: (cb: (s: string) => void) => {
      state.subscribed++
      state.status = cb
      return channel
    },
  }
  return {
    supabase: {
      from,
      channel: () => channel,
      getChannels: () => [],
      removeChannel: () => {
        state.removed++
        return Promise.resolve('ok')
      },
    },
  }
})

function run(id: string, over: Partial<FixRun> = {}): FixRun {
  return {
    id,
    bug_id: 'b1',
    workspace_id: 'ws',
    run_id: `r-${id}`,
    status: 'succeeded',
    branch: 'main',
    commit_sha: 'abc1234',
    pr_url: null,
    files_changed: 1,
    additions: 1,
    deletions: 0,
    summary: null,
    after_attachment_id: null,
    created_by: 'u1',
    started_at: `2026-10-07T12:00:0${id.slice(1)}Z`,
    finished_at: `2026-10-07T12:00:0${id.slice(1)}Z`,
    ...over,
  }
}

function emit(event: string, row: FixRun) {
  for (const hd of h.state.handlers) if (hd.filter.event === event) hd.cb({ new: row })
}

beforeEach(() => {
  Object.assign(h.state, {
    load: { data: [], error: null },
    insert: { data: null, error: null },
    inserted: [],
    queries: [],
    handlers: [],
    subscribed: 0,
    removed: 0,
    status: null,
  })
})

describe('recordFixRun', () => {
  const input = {
    bugId: 'b1',
    runId: '20261007-120000-4',
    status: 'succeeded' as const,
    summary: 'Fixed',
    report: null,
  }

  it('inserts the run and returns the stored row', async () => {
    h.state.insert = { data: run('f1'), error: null }
    await expect(recordFixRun(input)).resolves.toEqual(run('f1'))
    expect(h.state.inserted).toEqual([
      expect.objectContaining({ bug_id: 'b1', run_id: '20261007-120000-4', status: 'succeeded' }),
    ])
  })

  it('is a silent no-op before migration 0008 and when the run is already recorded', async () => {
    for (const error of [
      {
        code: 'PGRST205',
        message: "Could not find the table 'public.fix_runs' in the schema cache",
      },
      { code: '42P01', message: 'relation "public.fix_runs" does not exist' },
      { code: '23505', message: 'duplicate key value violates unique constraint' },
    ]) {
      h.state.insert = { data: null, error }
      await expect(recordFixRun(input)).resolves.toBeNull()
    }
  })

  it('throws any other error', async () => {
    h.state.insert = { data: null, error: { code: '42501', message: 'row-level security' } }
    await expect(recordFixRun(input)).rejects.toThrow('row-level security')
    h.state.insert = { data: null, error: { code: 'P0001', message: 'fix_run_limit' } }
    await expect(recordFixRun(input)).rejects.toThrow('fix_run_limit')
  })
})

describe('mergeFixRuns', () => {
  it('upserts by id, newest first', () => {
    const merged = mergeFixRuns(
      [run('f1'), run('f2')],
      [run('f3'), run('f1', { status: 'failed' })],
    )
    expect(merged.map((r) => r.id)).toEqual(['f3', 'f2', 'f1'])
    expect(merged[2].status).toBe('failed')
  })
})

describe('useFixRuns', () => {
  it('loads the bug’s runs, then follows inserts and updates for that bug', async () => {
    h.state.load = { data: [run('f1')], error: null }
    const { result } = renderHook(() => useFixRuns('b1'))
    expect(result.current.loading).toBe(true)
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.runs.map((r) => r.id)).toEqual(['f1'])
    expect(h.state.queries[0]).toEqual([
      'fix_runs',
      'bug_id=b1',
      'order started_at desc',
      'limit 50',
    ])
    await waitFor(() => expect(h.state.subscribed).toBe(1))
    expect(h.state.handlers.map((hd) => hd.filter)).toEqual([
      expect.objectContaining({ event: 'INSERT', filter: 'bug_id=eq.b1' }),
      expect.objectContaining({ event: 'UPDATE', filter: 'bug_id=eq.b1' }),
    ])
    act(() => {
      emit('INSERT', run('f2', { status: 'running', finished_at: null }))
      emit('INSERT', run('f9', { bug_id: 'other' }))
    })
    expect(result.current.runs.map((r) => r.id)).toEqual(['f2', 'f1'])
    act(() => emit('UPDATE', run('f2', { status: 'succeeded' })))
    expect(result.current.runs[0].status).toBe('succeeded')
    expect(result.current.available).toBe(true)
  })

  it('reloads on every SUBSCRIBED and unsubscribes on unmount', async () => {
    const { unmount } = renderHook(() => useFixRuns('b1'))
    await waitFor(() => expect(h.state.subscribed).toBe(1))
    act(() => h.state.status?.('SUBSCRIBED'))
    await waitFor(() => expect(h.state.queries).toHaveLength(2))
    unmount()
    expect(h.state.removed).toBe(1)
  })

  it('degrades silently when the table does not exist yet', async () => {
    h.state.load = {
      data: null,
      error: {
        code: 'PGRST205',
        message: "Could not find the table 'public.fix_runs' in the schema cache",
      },
    }
    const { result } = renderHook(() => useFixRuns('b1'))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current).toEqual({ runs: [], loading: false, available: false, error: null })
    expect(h.state.subscribed).toBe(0)
  })

  it('reports other load errors', async () => {
    h.state.load = { data: null, error: { code: '42501', message: 'denied' } }
    const { result } = renderHook(() => useFixRuns('b1'))
    await waitFor(() => expect(result.current.error).toBe('denied'))
    expect(result.current.runs).toEqual([])
  })

  it('does nothing without a bug', () => {
    const { result } = renderHook(() => useFixRuns(null))
    expect(result.current).toEqual({ runs: [], loading: false, available: true, error: null })
    expect(h.state.queries).toHaveLength(0)
  })
})
