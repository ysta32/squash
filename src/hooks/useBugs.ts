import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Database } from '../lib/database.types'
import type { Bug, BugAttachment, BugWithMeta, PendingUpload, Severity } from '../lib/types'
import { deriveTitle, randomId } from '../lib/utils'
import { compressImage } from './useImageCompression'
import { uploadAttachment } from '../lib/upload'
import { requireUserId } from './useBug'
import { openChannel } from './useRealtimeStatus'

export { useBug } from './useBug'
export { useSignedUrl } from './useSignedUrl'

export interface BugFilters {
  tab: 'open' | 'resolved' | 'all'
  filedBy: string | null
  resolvedBy: string | null
  severity: Severity | null
  query: string
}

export interface NewBugInput {
  description: string
  transcript: string | null
  severity: Severity
  files: File[]
}

export interface BugCounts {
  open: number
  resolved: number
  all: number
}

export interface UseBugsResult {
  bugs: BugWithMeta[]
  loading: boolean
  counts: BugCounts
  fileBug(input: NewBugInput): Promise<void>
  updateBug(
    id: string,
    patch: Partial<Pick<Bug, 'title' | 'description' | 'severity'>>,
  ): Promise<void>
  resolveBug(id: string, note: string | null): Promise<void>
  reopenBug(id: string, note: string | null): Promise<void>
  retryUploads(bugId: string): Promise<void>
  getBugByNumber(number: number): Promise<BugWithMeta | null>
}

export const FETCH_LIMIT = 1000

type BugRow = Database['public']['Tables']['bugs']['Row']
type BugRowWithAttachments = BugRow & { bug_attachments: BugAttachment[] }

const ERROR_MESSAGES: Record<string, string> = {
  rate_limited: 'Slow down — max 30 bugs per minute.',
  attachment_limit: 'Max 10 screenshots per bug.',
  too_large: 'Image is larger than 5 MB.',
  not_image: 'That file is not an image.',
}

/** Maps DB/storage/compression error codes (raised as the message) to user-facing text. */
export function friendlyError(err: unknown, fallback = 'Something went wrong. Try again.'): string {
  const message =
    err instanceof Error
      ? err.message
      : typeof err === 'object' &&
          err !== null &&
          'message' in err &&
          typeof err.message === 'string'
        ? err.message
        : ''
  for (const [code, text] of Object.entries(ERROR_MESSAGES)) {
    if (message.includes(code)) return text
  }
  return message || fallback
}

/** Pure list filter used by the bug list (tabs, people, severity, free-text and `#<number>`). */
export function filterBugs(bugs: BugWithMeta[], f: BugFilters): BugWithMeta[] {
  const q = f.query.trim().toLowerCase()
  const numberMatch = /^#(\d+)$/.exec(q)
  const wantedNumber = numberMatch ? Number(numberMatch[1]) : null
  return bugs.filter((b) => {
    if (f.tab !== 'all' && b.status !== f.tab) return false
    if (f.filedBy !== null && b.filed_by !== f.filedBy) return false
    if (f.resolvedBy !== null && b.resolved_by !== f.resolvedBy) return false
    if (f.severity !== null && b.severity !== f.severity) return false
    if (!q) return true
    if (wantedNumber !== null && b.number === wantedNumber) return true
    const haystack = `${b.title}\n${b.description}\n${b.transcript ?? ''}`.toLowerCase()
    return haystack.includes(q)
  })
}

export function countBugs(bugs: BugWithMeta[]): BugCounts {
  let open = 0
  let resolved = 0
  for (const b of bugs) {
    if (b.status === 'open') open++
    else resolved++
  }
  return { open, resolved, all: bugs.length }
}

function toBugWithMeta(row: BugRowWithAttachments): BugWithMeta {
  const { bug_attachments, ...bug } = row
  return { ...bug, attachments: sortAttachments(bug_attachments ?? []) }
}

function sortAttachments(list: BugAttachment[]): BugAttachment[] {
  return [...list].sort((a, b) => a.created_at.localeCompare(b.created_at))
}

function sortBugs(list: BugWithMeta[]): BugWithMeta[] {
  return [...list].sort((a, b) => b.created_at.localeCompare(a.created_at))
}

function isNewer(candidate: string, current: string): boolean {
  return Date.parse(candidate) >= Date.parse(current)
}

/** Overlays a server row onto local state, keeping attachments/pending and never going backwards. */
function applyServerRow(existing: BugWithMeta | undefined, row: BugRow): BugWithMeta {
  if (!existing) return { ...row, attachments: [] }
  if (!existing.optimistic && !isNewer(row.updated_at, existing.updated_at)) return existing
  return { ...existing, ...row, attachments: existing.attachments, optimistic: false }
}

function mergeAttachments(a: BugAttachment[], b: BugAttachment[]): BugAttachment[] {
  const ids = new Set(a.map((x) => x.id))
  const extra = b.filter((x) => !ids.has(x.id))
  return extra.length ? sortAttachments([...a, ...extra]) : a
}

/** Merge a fetched snapshot into state by id; local-only rows (optimistic, realtime) are kept. */
export function mergeSnapshot(current: BugWithMeta[], fetched: BugWithMeta[]): BugWithMeta[] {
  const byId = new Map(current.map((b) => [b.id, b]))
  const out: BugWithMeta[] = []
  const seen = new Set<string>()
  for (const f of fetched) {
    seen.add(f.id)
    const existing = byId.get(f.id)
    if (!existing) {
      out.push(f)
      continue
    }
    const { attachments, ...row } = f
    const merged = applyServerRow(existing, row)
    out.push({ ...merged, attachments: mergeAttachments(attachments, existing.attachments) })
  }
  for (const b of current) if (!seen.has(b.id)) out.push(b)
  return sortBugs(out)
}

function upsertRow(bugs: BugWithMeta[], row: BugRow): BugWithMeta[] {
  const idx = bugs.findIndex((b) => b.id === row.id)
  if (idx === -1) return sortBugs([...bugs, applyServerRow(undefined, row)])
  const next = applyServerRow(bugs[idx], row)
  if (next === bugs[idx]) return bugs
  const copy = bugs.slice()
  copy[idx] = next
  return copy
}

function mapBug(
  bugs: BugWithMeta[],
  id: string,
  fn: (b: BugWithMeta) => BugWithMeta,
): BugWithMeta[] {
  let changed = false
  const next = bugs.map((b) => {
    if (b.id !== id) return b
    const n = fn(b)
    if (n !== b) changed = true
    return n
  })
  return changed ? next : bugs
}

function patchPending(
  bug: BugWithMeta,
  localId: string,
  patch: Partial<PendingUpload> | null,
): BugWithMeta {
  if (!bug.pending) return bug
  const pending =
    patch === null
      ? bug.pending.filter((p) => p.localId !== localId)
      : bug.pending.map((p) => (p.localId === localId ? { ...p, ...patch } : p))
  return { ...bug, pending: pending.length ? pending : undefined }
}

interface QueuedFile {
  file: File
  previewUrl: string
  status: 'queued' | 'uploading' | 'failed'
}

interface ListState {
  workspaceId: string
  bugs: BugWithMeta[]
  loaded: boolean
}

const EMPTY: BugWithMeta[] = []

export function useBugs(
  workspaceId: string,
  opts?: { onRemoteInsert?: (bug: Bug) => void },
): UseBugsResult {
  const [state, setState] = useState<ListState>({ workspaceId, bugs: [], loaded: false })
  /** Workspace whose list is live. Async results for any other workspace are dropped. */
  const liveWsRef = useRef<string | null>(null)
  const selfIdRef = useRef<string | null>(null)
  /** Ids of bugs filed from this hook instance (never announced as remote inserts). */
  const localIdsRef = useRef(new Set<string>())
  /** Files awaiting upload, per bug id → local upload id. */
  const queueRef = useRef(new Map<string, Map<string, QueuedFile>>())
  const onRemoteInsertRef = useRef(opts?.onRemoteInsert)
  const bugsRef = useRef<BugWithMeta[]>(EMPTY)

  const current = state.workspaceId === workspaceId
  const bugs = current ? state.bugs : EMPTY
  const loading = !(current && state.loaded)

  useEffect(() => {
    onRemoteInsertRef.current = opts?.onRemoteInsert
  })
  useEffect(() => {
    bugsRef.current = bugs
  }, [bugs])

  const mutate = useCallback(
    (ws: string, fn: (bugs: BugWithMeta[]) => BugWithMeta[], markLoaded = false) => {
      if (liveWsRef.current !== ws) return
      setState((s) => {
        const base = s.workspaceId === ws ? s : { workspaceId: ws, bugs: EMPTY, loaded: false }
        const nextBugs = fn(base.bugs)
        if (nextBugs === base.bugs && base === s && (!markLoaded || s.loaded)) return s
        return { workspaceId: ws, bugs: nextBugs, loaded: base.loaded || markLoaded }
      })
    },
    [],
  )

  useEffect(() => {
    let active = true
    void supabase.auth.getSession().then(({ data }) => {
      if (active) selfIdRef.current = data.session?.user.id ?? null
    })
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    liveWsRef.current = workspaceId
    let active = true

    const load = async () => {
      const { data, error } = await supabase
        .from('bugs')
        .select('*, bug_attachments(*)')
        .eq('workspace_id', workspaceId)
        .order('created_at', { ascending: false })
        .limit(FETCH_LIMIT)
      if (!active) return
      if (error) {
        console.error('Failed to load bugs', error)
        mutate(workspaceId, (b) => b, true)
        return
      }
      const fetched = (data ?? []).map(toBugWithMeta)
      mutate(workspaceId, (b) => mergeSnapshot(b, fetched), true)
    }

    let subscribedOnce = false
    const channel = openChannel(`ws:${workspaceId}:bugs`)
      .on<BugRow>(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'bugs',
          filter: `workspace_id=eq.${workspaceId}`,
        },
        (payload) => {
          if (!active) return
          const row = payload.new
          mutate(workspaceId, (b) => upsertRow(b, row))
          const mine = localIdsRef.current.has(row.id) || row.filed_by === selfIdRef.current
          if (!mine) onRemoteInsertRef.current?.(row)
        },
      )
      .on<BugRow>(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'bugs',
          filter: `workspace_id=eq.${workspaceId}`,
        },
        (payload) => {
          if (!active) return
          const row = payload.new
          mutate(workspaceId, (b) => upsertRow(b, row))
        },
      )
      .on<BugAttachment>(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'bug_attachments' },
        (payload) => {
          if (!active) return
          const att = payload.new
          mutate(workspaceId, (b) =>
            mapBug(b, att.bug_id, (bug) => {
              const attachments = mergeAttachments(bug.attachments, [att])
              return attachments === bug.attachments ? bug : { ...bug, attachments }
            }),
          )
        },
      )
      .on<BugAttachment>(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'bug_attachments' },
        (payload) => {
          if (!active) return
          const removedId = payload.old.id
          if (!removedId) return
          mutate(workspaceId, (b) => {
            const holder = b.find((bug) => bug.attachments.some((a) => a.id === removedId))
            if (!holder) return b
            return mapBug(b, holder.id, (bug) => ({
              ...bug,
              attachments: bug.attachments.filter((a) => a.id !== removedId),
            }))
          })
        },
      )

    channel.subscribe((status) => {
      if (!active || status !== 'SUBSCRIBED') return
      // The first SUBSCRIBED races the initial fetch below; later ones follow a reconnect and
      // may have missed changes, so refetch and merge.
      if (subscribedOnce) void load()
      subscribedOnce = true
    })
    void load()

    return () => {
      active = false
      if (liveWsRef.current === workspaceId) liveWsRef.current = null
      void supabase.removeChannel(channel)
    }
  }, [workspaceId, mutate])

  const runUploads = useCallback(
    async (ws: string, bugId: string, onlyFailed: boolean) => {
      const queue = queueRef.current.get(bugId)
      if (!queue) return
      const targets = [...queue.entries()].filter(([, q]) =>
        onlyFailed ? q.status === 'failed' : q.status === 'queued',
      )
      for (const [localId, item] of targets) {
        item.status = 'uploading'
        mutate(ws, (b) =>
          mapBug(b, bugId, (bug) => patchPending(bug, localId, { progress: 0, error: undefined })),
        )
        try {
          const image = await compressImage(item.file)
          let attachment: BugAttachment
          try {
            attachment = await uploadAttachment({
              workspaceId: ws,
              bugId,
              image,
              onProgress: (p) =>
                mutate(ws, (b) =>
                  mapBug(b, bugId, (bug) => patchPending(bug, localId, { progress: p })),
                ),
            })
          } finally {
            if (image.previewUrl) URL.revokeObjectURL(image.previewUrl)
          }
          queue.delete(localId)
          if (queue.size === 0) queueRef.current.delete(bugId)
          mutate(ws, (b) =>
            mapBug(b, bugId, (bug) => ({
              ...patchPending(bug, localId, null),
              attachments: mergeAttachments(bug.attachments, [attachment]),
            })),
          )
          URL.revokeObjectURL(item.previewUrl)
        } catch (err) {
          item.status = 'failed'
          const message = friendlyError(err, 'Upload failed.')
          mutate(ws, (b) =>
            mapBug(b, bugId, (bug) => patchPending(bug, localId, { error: message })),
          )
        }
      }
    },
    [mutate],
  )

  const fileBug = useCallback(
    async (input: NewBugInput) => {
      const ws = workspaceId
      const filedBy = await requireUserId()
      selfIdRef.current = filedBy
      const id = randomId()
      const now = new Date().toISOString()
      const title =
        deriveTitle(input.description) || deriveTitle(input.transcript ?? '') || 'Untitled bug'
      const description = input.description.trim()
      const transcript = input.transcript?.trim() ? input.transcript.trim() : null

      const queue = new Map<string, QueuedFile>()
      const pending: PendingUpload[] = input.files.map((file) => {
        const localId = randomId()
        const previewUrl = URL.createObjectURL(file)
        queue.set(localId, { file, previewUrl, status: 'queued' })
        return { localId, previewUrl, progress: 0 }
      })
      if (queue.size) queueRef.current.set(id, queue)
      localIdsRef.current.add(id)

      const optimistic: BugWithMeta = {
        id,
        workspace_id: ws,
        number: 0,
        title,
        description,
        transcript,
        severity: input.severity,
        status: 'open',
        filed_by: filedBy,
        created_at: now,
        resolved_by: null,
        resolved_at: null,
        resolution_note: null,
        updated_at: now,
        attachments: [],
        pending: pending.length ? pending : undefined,
        optimistic: true,
      }
      mutate(ws, (b) => [optimistic, ...b.filter((x) => x.id !== id)])

      let inserted: BugRow | null = null
      let failure: unknown = null
      try {
        const { data, error } = await supabase
          .from('bugs')
          .insert({
            id,
            workspace_id: ws,
            title,
            description,
            transcript,
            severity: input.severity,
            filed_by: filedBy,
          })
          .select()
          .single()
        if (error) failure = error
        else inserted = data
      } catch (err) {
        failure = err
      }

      if (!inserted) {
        mutate(ws, (b) => b.filter((x) => x.id !== id))
        queueRef.current.delete(id)
        localIdsRef.current.delete(id)
        for (const p of pending) URL.revokeObjectURL(p.previewUrl)
        throw new Error(friendlyError(failure, 'Could not file the bug. Try again.'))
      }

      const row = inserted
      mutate(ws, (b) => mapBug(b, id, (bug) => ({ ...bug, ...row, optimistic: false })))
      if (queue.size) void runUploads(ws, id, false)
    },
    [workspaceId, mutate, runUploads],
  )

  const patchBug = useCallback(
    async (
      id: string,
      optimisticPatch: Partial<BugWithMeta>,
      dbPatch: Database['public']['Tables']['bugs']['Update'],
    ) => {
      const ws = workspaceId
      const before = bugsRef.current.find((b) => b.id === id)
      const keys = Object.keys(optimisticPatch) as (keyof BugWithMeta)[]
      mutate(ws, (b) => mapBug(b, id, (bug) => ({ ...bug, ...optimisticPatch })))
      const { error } = await supabase.from('bugs').update(dbPatch).eq('id', id)
      if (!error) return
      if (before) {
        // Revert only fields that still hold our optimistic value (a newer remote change wins).
        mutate(ws, (b) =>
          mapBug(b, id, (bug) => {
            const reverted: BugWithMeta = { ...bug }
            const target = reverted as unknown as Record<string, unknown>
            for (const k of keys) {
              if (bug[k] === optimisticPatch[k]) target[k] = before[k]
            }
            return reverted
          }),
        )
      }
      throw new Error(friendlyError(error, 'Could not save changes.'))
    },
    [workspaceId, mutate],
  )

  const updateBug = useCallback(
    (id: string, patch: Partial<Pick<Bug, 'title' | 'description' | 'severity'>>) =>
      patchBug(id, patch, patch),
    [patchBug],
  )

  const resolveBug = useCallback(
    async (id: string, note: string | null) => {
      const self = selfIdRef.current
      await patchBug(
        id,
        {
          status: 'resolved',
          resolution_note: note,
          resolved_by: self,
          resolved_at: new Date().toISOString(),
        },
        { status: 'resolved', resolution_note: note },
      )
    },
    [patchBug],
  )

  const reopenBug = useCallback(
    async (id: string, note: string | null) => {
      await patchBug(
        id,
        { status: 'open', resolution_note: note, resolved_by: null, resolved_at: null },
        { status: 'open', resolution_note: note },
      )
    },
    [patchBug],
  )

  const retryUploads = useCallback(
    (bugId: string) => runUploads(workspaceId, bugId, true),
    [workspaceId, runUploads],
  )

  const getBugByNumber = useCallback(
    async (number: number): Promise<BugWithMeta | null> => {
      const ws = workspaceId
      const known = bugsRef.current.find((b) => b.number === number && !b.optimistic)
      if (known) return known
      const { data, error } = await supabase
        .from('bugs')
        .select('*, bug_attachments(*)')
        .eq('workspace_id', ws)
        .eq('number', number)
        .maybeSingle()
      if (error) throw new Error(friendlyError(error, 'Could not load that bug.'))
      if (!data) return null
      const bug = toBugWithMeta(data)
      mutate(ws, (b) => mergeSnapshot(b, [bug]))
      return bug
    },
    [workspaceId, mutate],
  )

  const counts = useMemo(() => countBugs(bugs), [bugs])

  return {
    bugs,
    loading,
    counts,
    fileBug,
    updateBug,
    resolveBug,
    reopenBug,
    retryUploads,
    getBugByNumber,
  }
}
