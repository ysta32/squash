import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { BugEvent, Comment } from '../lib/types'
import { openChannel } from './useRealtimeStatus'

/** Current user id from the locally stored session; throws when signed out. */
export async function requireUserId(): Promise<string> {
  const { data, error } = await supabase.auth.getSession()
  const id = data.session?.user.id
  if (error || !id) throw new Error('You are signed out. Sign in and try again.')
  return id
}

interface WithIdAndTime {
  id: string
  created_at: string
}

/** Adds rows not yet present (by id) and keeps the list in chronological order. */
export function mergeById<T extends WithIdAndTime>(current: T[], incoming: T[]): T[] {
  const seen = new Set(current.map((r) => r.id))
  const additions = incoming.filter((r) => {
    if (seen.has(r.id)) return false
    seen.add(r.id)
    return true
  })
  if (additions.length === 0) return current
  return [...current, ...additions].sort((a, b) => a.created_at.localeCompare(b.created_at))
}

/** Later edit wins; a row never edited (null) is older than any edit. */
function isNewer(incoming: Comment, current: Comment): boolean {
  if (incoming.edited_at === null) return false
  if (current.edited_at === null) return true
  // Parsed, not string-compared: REST and realtime payloads may format timestamps differently.
  return Date.parse(incoming.edited_at) > Date.parse(current.edited_at)
}

/**
 * Merges comment rows into the list: unknown ids are added, known ids are replaced only by a newer
 * edit (so a stale fetch never undoes a realtime edit), ids in `deleted` are dropped. When
 * `snapshot` is set, `incoming` is a full server listing and rows in `snapshot` (ids that were
 * already known before that listing was requested) but missing from it are dropped as deleted.
 */
export function upsertComments(
  current: Comment[],
  incoming: Comment[],
  deleted: ReadonlySet<string>,
  snapshot?: ReadonlySet<string>,
): Comment[] {
  const byId = new Map(current.map((c) => [c.id, c]))
  let changed = false
  if (snapshot) {
    const listed = new Set(incoming.map((c) => c.id))
    for (const id of snapshot) {
      if (!listed.has(id) && byId.delete(id)) changed = true
    }
  }
  for (const id of deleted) {
    if (byId.delete(id)) changed = true
  }
  for (const row of incoming) {
    if (deleted.has(row.id)) continue
    const known = byId.get(row.id)
    if (known && !isNewer(row, known)) continue
    byId.set(row.id, row)
    changed = true
  }
  if (!changed) return current
  return [...byId.values()].sort((a, b) => a.created_at.localeCompare(b.created_at))
}

interface BugThreadState {
  bugId: string | null
  comments: Comment[]
  events: BugEvent[]
  loaded: boolean
}

const EMPTY_COMMENTS: Comment[] = []
const EMPTY_EVENTS: BugEvent[] = []

export function useBug(bugId: string | null): {
  comments: Comment[]
  events: BugEvent[]
  addComment(body: string): Promise<void>
  editComment(id: string, body: string): Promise<void>
  deleteComment(id: string): Promise<void>
  loading: boolean
} {
  const [state, setState] = useState<BugThreadState>({
    bugId: null,
    comments: [],
    events: [],
    loaded: false,
  })
  /** The bug whose thread is currently live; late results for any other bug are dropped. */
  const liveBugRef = useRef<string | null>(null)
  /** Comment ids deleted while this bug is open; late inserts / fetches never bring them back. */
  const deletedRef = useRef<Set<string>>(new Set())
  /** Comment ids currently shown, read when a fetch starts (see upsertComments' snapshot). */
  const shownRef = useRef<Comment[]>([])

  const apply = useCallback((id: string, fn: (s: BugThreadState) => BugThreadState) => {
    if (liveBugRef.current !== id) return
    setState((s) => fn(s.bugId === id ? s : { bugId: id, comments: [], events: [], loaded: false }))
  }, [])

  useEffect(() => {
    if (!bugId) return
    liveBugRef.current = bugId
    deletedRef.current = new Set()
    const deleted = deletedRef.current
    let active = true

    const channel = openChannel(`bug:${bugId}`)
      .on<Comment>(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'comments', filter: `bug_id=eq.${bugId}` },
        (payload) => {
          if (!active) return
          apply(bugId, (s) => ({
            ...s,
            comments: upsertComments(s.comments, [payload.new], deleted),
          }))
        },
      )
      .on<Comment>(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'comments', filter: `bug_id=eq.${bugId}` },
        (payload) => {
          if (!active) return
          apply(bugId, (s) => ({
            ...s,
            comments: upsertComments(s.comments, [payload.new], deleted),
          }))
        },
      )
      // DELETE events cannot be filtered by column (and carry only the id under RLS), so this sees
      // every comment deletion the server sends; ids that are not in this thread are no-ops.
      .on<Comment>(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'comments' },
        (payload) => {
          if (!active) return
          const removedId = payload.old.id
          if (!removedId) return
          deleted.add(removedId)
          apply(bugId, (s) => ({ ...s, comments: upsertComments(s.comments, [], deleted) }))
        },
      )
      .on<BugEvent>(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'bug_events', filter: `bug_id=eq.${bugId}` },
        (payload) => {
          if (!active) return
          apply(bugId, (s) => ({ ...s, events: mergeById(s.events, [payload.new]) }))
        },
      )
    let latest = 0
    const load = () => {
      const seq = ++latest
      // Every id shown now came from the server, so one missing from this listing was deleted.
      const known = new Set(shownRef.current.map((c) => c.id))
      void Promise.all([
        supabase
          .from('comments')
          .select('*')
          .eq('bug_id', bugId)
          .order('created_at', { ascending: true }),
        supabase
          .from('bug_events')
          .select('*')
          .eq('bug_id', bugId)
          .order('created_at', { ascending: true }),
      ]).then(
        ([c, e]) => {
          if (!active || seq !== latest) return
          if (c.error) console.error('Failed to load comments', c.error)
          if (e.error) console.error('Failed to load bug history', e.error)
          apply(bugId, (s) => ({
            ...s,
            comments: c.data ? upsertComments(s.comments, c.data, deleted, known) : s.comments,
            events: mergeById(s.events, e.data ?? []),
            loaded: true,
          }))
        },
        (err: unknown) => {
          if (!active || seq !== latest) return
          console.error('Failed to load bug thread', err)
          apply(bugId, (s) => ({ ...s, loaded: true }))
        },
      )
    }

    // Fetch on every (re)SUBSCRIBED so changes missed while disconnected are merged in. If the
    // channel never connects, fall back to a single plain fetch so the thread still renders.
    let everSubscribed = false
    let fallbackDone = false
    channel.subscribe((status) => {
      if (!active) return
      if (status === 'SUBSCRIBED') {
        everSubscribed = true
        load()
      } else if (
        (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') &&
        !everSubscribed &&
        !fallbackDone
      ) {
        fallbackDone = true
        load()
      }
    })

    return () => {
      active = false
      if (liveBugRef.current === bugId) liveBugRef.current = null
      void supabase.removeChannel(channel)
    }
  }, [bugId, apply])

  const addComment = useCallback(
    async (body: string) => {
      if (!bugId) throw new Error('No bug selected.')
      const text = body.trim()
      if (!text) throw new Error('Comment is empty.')
      const authorId = await requireUserId()
      const { data, error } = await supabase
        .from('comments')
        .insert({ bug_id: bugId, author_id: authorId, body: text })
        .select()
        .single()
      if (error?.message.includes('rate_limited')) {
        throw new Error('Slow down — max 30 comments per minute.')
      }
      if (error || !data) throw new Error(error?.message ?? 'Could not post comment.')
      apply(bugId, (s) => ({
        ...s,
        comments: upsertComments(s.comments, [data], deletedRef.current),
      }))
    },
    [bugId, apply],
  )

  const editComment = useCallback(
    async (id: string, body: string) => {
      if (!bugId) throw new Error('No bug selected.')
      const text = body.trim()
      if (!text) throw new Error('Comment is empty.')
      const { data, error } = await supabase
        .from('comments')
        .update({ body: text })
        .eq('id', id)
        .select()
        .maybeSingle()
      if (error) throw new Error(error.message)
      // RLS hides the row from the update when it is not yours or no longer exists.
      if (!data) throw new Error('This comment can no longer be edited.')
      apply(bugId, (s) => ({
        ...s,
        comments: upsertComments(s.comments, [data], deletedRef.current),
      }))
    },
    [bugId, apply],
  )

  const deleteComment = useCallback(
    async (id: string) => {
      if (!bugId) throw new Error('No bug selected.')
      const { data, error } = await supabase.from('comments').delete().eq('id', id).select('id')
      if (error) throw new Error(error.message)
      if (!data || data.length === 0) {
        // Not deleted: either already gone (fine) or not allowed. Only the latter is an error.
        const { data: still } = await supabase
          .from('comments')
          .select('id')
          .eq('id', id)
          .maybeSingle()
        if (still) throw new Error('You cannot delete this comment.')
      }
      deletedRef.current.add(id)
      apply(bugId, (s) => ({
        ...s,
        comments: upsertComments(s.comments, [], deletedRef.current),
      }))
    },
    [bugId, apply],
  )

  const current = bugId !== null && state.bugId === bugId
  const comments = current ? state.comments : EMPTY_COMMENTS
  useEffect(() => {
    shownRef.current = comments
  }, [comments])
  return {
    comments,
    events: current ? state.events : EMPTY_EVENTS,
    addComment,
    editComment,
    deleteComment,
    loading: bugId !== null && !(current && state.loaded),
  }
}
