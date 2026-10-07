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

  const apply = useCallback((id: string, fn: (s: BugThreadState) => BugThreadState) => {
    if (liveBugRef.current !== id) return
    setState((s) => fn(s.bugId === id ? s : { bugId: id, comments: [], events: [], loaded: false }))
  }, [])

  useEffect(() => {
    if (!bugId) return
    liveBugRef.current = bugId
    let active = true

    const channel = openChannel(`bug:${bugId}`)
      .on<Comment>(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'comments', filter: `bug_id=eq.${bugId}` },
        (payload) => {
          if (!active) return
          apply(bugId, (s) => ({ ...s, comments: mergeById(s.comments, [payload.new]) }))
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
            comments: mergeById(s.comments, c.data ?? []),
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
      apply(bugId, (s) => ({ ...s, comments: mergeById(s.comments, [data]) }))
    },
    [bugId, apply],
  )

  const current = bugId !== null && state.bugId === bugId
  return {
    comments: current ? state.comments : EMPTY_COMMENTS,
    events: current ? state.events : EMPTY_EVENTS,
    addComment,
    loading: bugId !== null && !(current && state.loaded),
  }
}
