import { useEffect, useState } from 'react'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { buildFixRunInsert, isMissingRelation, type FixRun, type FixRunInput } from '../lib/fixRuns'
import { supabase } from '../lib/supabase'
import { openChannel } from './useRealtimeStatus'

const TABLE = 'fix_runs'
const LIMIT = 50

/**
 * Records one Claude Code run on one bug. Returns the stored row, or null when there is nothing to
 * record: the server has not run migration 0008 yet (no fix_runs table), or this run was already
 * recorded for the bug (another tab, or a retry). Throws on any other failure.
 */
export async function recordFixRun(input: FixRunInput): Promise<FixRun | null> {
  const row = buildFixRunInsert(input)
  const { data, error } = await supabase.from(TABLE).insert(row).select().single()
  if (!error) return data
  if (isMissingRelation(error, TABLE)) return null
  if ((error as { code?: unknown }).code === '23505') return null
  throw new Error(error.message || 'Could not record the fix.')
}

/**
 * Upserts rows by id, newest run first. A finished run never goes back to 'running' (the server
 * forbids it), so a stale copy of a run that is still running never replaces a finished one.
 */
export function mergeFixRuns(current: FixRun[], rows: FixRun[]): FixRun[] {
  const byId = new Map(current.map((r) => [r.id, r]))
  for (const r of rows) {
    const known = byId.get(r.id)
    if (known && known.status !== 'running' && r.status === 'running') continue
    byId.set(r.id, r)
  }
  return [...byId.values()].sort(
    (a, b) => b.started_at.localeCompare(a.started_at) || b.id.localeCompare(a.id),
  )
}

interface State {
  bugId: string
  runs: FixRun[]
  loaded: boolean
  /** False when the server has no fix_runs table yet. */
  available: boolean
  error: string | null
}

export interface UseFixRunsResult {
  /** Newest first. */
  runs: FixRun[]
  loading: boolean
  /** False when the server has not run migration 0008 yet; runs is then always empty. */
  available: boolean
  error: string | null
}

/** The bug's recorded fix runs, kept live over realtime. */
export function useFixRuns(bugId: string | null): UseFixRunsResult {
  const [state, setState] = useState<State | null>(null)

  useEffect(() => {
    if (!bugId) return
    let active = true
    let channel: RealtimeChannel | null = null
    let latest = 0
    /**
     * Realtime rows received while a load is in flight. They are applied at once and replayed on top
     * of the load's snapshot, which may have been read before them.
     */
    let pending: FixRun[] | null = null
    const fresh = (): State => ({ bugId, runs: [], loaded: false, available: true, error: null })
    const apply = (fn: (s: State) => State) => {
      if (active) setState((s) => fn(s?.bugId === bugId ? s : fresh()))
    }

    /** Resolves true while the table exists. */
    const load = async (): Promise<boolean> => {
      const seq = ++latest
      // Each load starts its own buffer: anything received before this load began is already in the
      // database it reads, and replaying an older load's buffer could overwrite a newer snapshot.
      pending = []
      try {
        const { data, error } = await supabase
          .from(TABLE)
          .select('*')
          .eq('bug_id', bugId)
          .order('started_at', { ascending: false })
          .limit(LIMIT)
        if (seq !== latest) return true
        const replay = pending ?? []
        pending = null
        if (error && isMissingRelation(error, TABLE)) {
          apply((s) => ({ ...s, runs: [], loaded: true, available: false, error: null }))
          return false
        }
        apply((s) =>
          error
            ? { ...s, loaded: true, error: error.message }
            : {
                ...s,
                runs: mergeFixRuns(mergeFixRuns(s.runs, data ?? []), replay),
                loaded: true,
                error: null,
              },
        )
      } catch (err) {
        if (seq === latest) {
          pending = null
          apply((s) => ({
            ...s,
            loaded: true,
            error: err instanceof Error ? err.message : 'Could not load fixes.',
          }))
        }
      }
      return true
    }

    const subscribe = () => {
      const onRow = (payload: { new: FixRun }) => {
        if (!active || payload.new?.bug_id !== bugId) return
        pending?.push(payload.new)
        apply((s) => ({ ...s, runs: mergeFixRuns(s.runs, [payload.new]) }))
      }
      const filter = `bug_id=eq.${bugId}`
      channel = openChannel(`fix_runs:${bugId}`)
        .on<FixRun>(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: TABLE, filter },
          onRow,
        )
        .on<FixRun>(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: TABLE, filter },
          onRow,
        )
      // Reload on every (re)SUBSCRIBED so changes missed while disconnected are merged in.
      channel.subscribe((status) => {
        if (active && status === 'SUBSCRIBED') void load()
      })
    }

    // Subscribe only once the table is known to exist: before migration 0008 there is nothing to follow.
    void load().then((exists) => {
      if (active && exists) subscribe()
    })

    return () => {
      active = false
      if (channel) void supabase.removeChannel(channel)
    }
  }, [bugId])

  const current = bugId && state?.bugId === bugId ? state : null
  return {
    runs: current?.runs ?? [],
    loading: bugId !== null && !current?.loaded,
    available: current?.available ?? true,
    error: current?.error ?? null,
  }
}
