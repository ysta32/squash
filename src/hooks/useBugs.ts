import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { supabase } from '../lib/supabase'
import type { Database } from '../lib/database.types'
import type {
  Bug,
  BugAttachment,
  BugKind,
  BugWithMeta,
  PendingUpload,
  Severity,
} from '../lib/types'
import { deriveTitle, randomId } from '../lib/utils'
import { compressImage } from './useImageCompression'
import { uploadAttachment } from '../lib/upload'
import { removeScreenshots } from '../lib/storageCleanup'
import { requireUserId } from './useBug'
import { openChannel } from './useRealtimeStatus'

export { useBug } from './useBug'
export { useSignedUrl } from './useSignedUrl'

export interface BugFilters {
  /** Bugs or feature requests: the list only ever shows one kind. */
  kind: BugKind
  tab: 'open' | 'resolved' | 'all'
  filedBy: string | null
  resolvedBy: string | null
  /** null = anyone, 'none' = unassigned only, else a user id. */
  assignee: string | null
  severity: Severity | null
  query: string
}

export interface NewBugInput {
  description: string
  transcript: string | null
  severity: Severity
  kind: BugKind
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
  error: string | null
  reload: () => void
  counts: BugCounts
  /** `onOptimistic` runs with the new bug's id as soon as its optimistic row is in the list. */
  fileBug(input: NewBugInput, opts?: { onOptimistic?: (id: string) => void }): Promise<void>
  updateBug(
    id: string,
    patch: Partial<Pick<Bug, 'title' | 'description' | 'severity' | 'kind'>>,
  ): Promise<void>
  resolveBug(id: string, note: string | null): Promise<void>
  reopenBug(id: string, note: string | null): Promise<void>
  /** Sets (or with null clears) the assignee; optimistic, reverts on error. */
  assignBug(id: string, userId: string | null): Promise<void>
  /** Permanently deletes a bug with its screenshots, comments and activity. */
  deleteBug(id: string): Promise<void>
  retryUploads(bugId: string): Promise<void>
  getBugByNumber(number: number): Promise<BugWithMeta | null>
}

export const FETCH_LIMIT = 1000

type BugRow = Database['public']['Tables']['bugs']['Row']
type BugRowWithAttachments = BugRow & { bug_attachments: BugAttachment[] }

const ERROR_MESSAGES: Record<string, string> = {
  rate_limited: 'Slow down — max 30 bugs per minute.',
  attachment_limit: 'Max 10 screenshots per bug.',
  assignee_not_member: 'That person is not a member of this workspace.',
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

/** Pure list filter used by the bug list (kind, tabs, people, severity, free-text and `#<number>`). */
export function filterBugs(bugs: BugWithMeta[], f: BugFilters): BugWithMeta[] {
  const q = f.query.trim().toLowerCase()
  const numberMatch = /^#(\d+)$/.exec(q)
  const wantedNumber = numberMatch ? Number(numberMatch[1]) : null
  return bugs.filter((b) => {
    if (b.kind !== f.kind) return false
    if (f.tab !== 'all' && b.status !== f.tab) return false
    if (f.filedBy !== null && b.filed_by !== f.filedBy) return false
    if (f.resolvedBy !== null && b.resolved_by !== f.resolvedBy) return false
    if (
      f.assignee === 'none'
        ? b.assignee_id !== null
        : f.assignee !== null && b.assignee_id !== f.assignee
    )
      return false
    if (f.severity !== null && b.severity !== f.severity) return false
    if (!q) return true
    if (wantedNumber !== null && b.number === wantedNumber) return true
    const haystack = `${b.title}\n${b.description}\n${b.transcript ?? ''}`.toLowerCase()
    return haystack.includes(q)
  })
}

/** Status counts, of one kind only when `kind` is given. */
export function countBugs(bugs: BugWithMeta[], kind?: BugKind): BugCounts {
  let open = 0
  let resolved = 0
  for (const b of bugs) {
    if (kind !== undefined && b.kind !== kind) continue
    if (b.status === 'open') open++
    else resolved++
  }
  return { open, resolved, all: open + resolved }
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

function removeBug(bugs: BugWithMeta[], id: string): BugWithMeta[] {
  return bugs.some((b) => b.id === id) ? bugs.filter((b) => b.id !== id) : bugs
}

/**
 * Keys of rows/attachments changed locally or via realtime after the latest list fetch started
 * (`bug:<id>`, `att:<id>`, `del:<attachmentId>`); a snapshot cannot know about those yet.
 */
export interface SnapshotOptions {
  truncated: boolean
  isRecent: (key: string) => boolean
  /** Completed uploads the snapshot may predate, by bug id; merged into bugs it contains. */
  retained?: (bugId: string) => BugAttachment[]
}

function snapshotAttachments(
  snapshot: BugAttachment[],
  local: BugAttachment[],
  isRecent: (key: string) => boolean,
): BugAttachment[] {
  const kept = snapshot.filter((a) => !isRecent(`del:${a.id}`))
  const ids = new Set(kept.map((a) => a.id))
  const extra = local.filter((a) => !ids.has(a.id) && isRecent(`att:${a.id}`))
  return sortAttachments([...kept, ...extra])
}

/**
 * Applies an authoritative list snapshot. Rows never go backwards (updated_at), attachments are
 * the snapshot's, and bugs missing from it are dropped unless optimistic, changed after the fetch
 * started, or older than the window of a truncated snapshot.
 */
export function applySnapshot(
  current: BugWithMeta[],
  fetched: BugWithMeta[],
  opts: SnapshotOptions,
): BugWithMeta[] {
  const byId = new Map(current.map((b) => [b.id, b]))
  const fetchedIds = new Set(fetched.map((f) => f.id))
  const oldest = fetched.reduce<string | null>(
    (min, f) => (min === null || f.created_at < min ? f.created_at : min),
    null,
  )
  const out: BugWithMeta[] = []
  for (const f of fetched) {
    const existing = byId.get(f.id)
    const base = existing ? applyServerRow(existing, f) : f
    const attachments = snapshotAttachments(
      f.attachments,
      existing?.attachments ?? [],
      opts.isRecent,
    )
    const retained = (opts.retained?.(f.id) ?? []).filter((a) => !opts.isRecent(`del:${a.id}`))
    out.push({ ...base, attachments: mergeAttachments(attachments, retained) })
  }
  for (const b of current) {
    if (fetchedIds.has(b.id)) continue
    const olderThanWindow = opts.truncated && oldest !== null && b.created_at < oldest
    if (b.optimistic || opts.isRecent(`bug:${b.id}`) || olderThanWindow) out.push(b)
  }
  return sortBugs(out)
}

/** Non-authoritative merge of individually fetched rows (e.g. a deep-linked bug). */
function mergeRows(current: BugWithMeta[], rows: BugWithMeta[]): BugWithMeta[] {
  let next = current
  for (const r of rows) {
    const existing = next.find((b) => b.id === r.id)
    if (!existing) {
      next = sortBugs([...next, r])
      continue
    }
    next = mapBug(next, r.id, (bug) => ({
      ...applyServerRow(bug, r),
      attachments: mergeAttachments(r.attachments, bug.attachments),
    }))
  }
  return next
}

// ---------------------------------------------------------------------------------------------
// Pending uploads live at module level (per workspace) so failed uploads, with their File for
// retry, survive workspace switches and remounts.

interface PendingFile extends PendingUpload {
  file: File
  status: 'queued' | 'uploading' | 'failed'
}

type PendingByBug = Readonly<Record<string, PendingUpload[]>>

const pendingFiles = new Map<string, Map<string, PendingFile[]>>()
const pendingSnapshots = new Map<string, PendingByBug>()
const pendingListeners = new Set<() => void>()
const NO_PENDING: PendingByBug = {}

function publishPending(ws: string): void {
  const snapshot: Record<string, PendingUpload[]> = {}
  for (const [bugId, files] of pendingFiles.get(ws) ?? []) {
    snapshot[bugId] = files.map(({ localId, previewUrl, progress, error }) =>
      error === undefined
        ? { localId, previewUrl, progress }
        : { localId, previewUrl, progress, error },
    )
  }
  if (Object.keys(snapshot).length) pendingSnapshots.set(ws, snapshot)
  else pendingSnapshots.delete(ws)
  for (const listener of pendingListeners) listener()
}

function subscribePending(listener: () => void): () => void {
  pendingListeners.add(listener)
  return () => {
    pendingListeners.delete(listener)
  }
}

function setPending(ws: string, bugId: string, files: PendingFile[]): void {
  let byBug = pendingFiles.get(ws)
  if (!byBug) {
    byBug = new Map()
    pendingFiles.set(ws, byBug)
  }
  byBug.set(bugId, files)
  publishPending(ws)
}

/** Removes one pending file (or all of a bug's when `localId` is omitted). */
function removePending(ws: string, bugId: string, localId?: string): void {
  const byBug = pendingFiles.get(ws)
  const files = byBug?.get(bugId)
  if (!byBug || !files) return
  const rest = localId === undefined ? [] : files.filter((f) => f.localId !== localId)
  if (rest.length) byBug.set(bugId, rest)
  else byBug.delete(bugId)
  if (byBug.size === 0) pendingFiles.delete(ws)
  publishPending(ws)
}

type CompletedListener = (ws: string, attachment: BugAttachment) => void
const completedListeners = new Set<CompletedListener>()

/**
 * Completed uploads retained per workspace (bug id → attachment id → entry) only while a list
 * fetch that started before the completion is still in flight: that fetch's snapshot may lack
 * them. With no such fetch, the live state merge (and any later fetch) already has them.
 * `seq` orders completions against fetch starts (same counter as `fetchesInFlight`).
 */
interface RetainedAttachment {
  attachment: BugAttachment
  seq: number
}
const retainedCompleted = new Map<string, Map<string, Map<string, RetainedAttachment>>>()
/** Start sequence numbers of list fetches currently in flight, per workspace. */
const fetchesInFlight = new Map<string, Set<number>>()
/** Mounted useBugs instances per workspace. */
const mountedHooks = new Map<string, number>()
let syncSeq = 0

/** Announces a finished upload to every mounted useBugs instance. */
function publishCompleted(ws: string, attachment: BugAttachment): void {
  const seq = ++syncSeq
  // Every in-flight fetch started before `seq`, so any of them may miss this attachment. With no
  // hook mounted for the workspace, nothing will apply those fetches, so nothing is retained.
  if ((mountedHooks.get(ws) ?? 0) > 0 && fetchesInFlight.get(ws)?.size) {
    let byBug = retainedCompleted.get(ws)
    if (!byBug) {
      byBug = new Map()
      retainedCompleted.set(ws, byBug)
    }
    let byId = byBug.get(attachment.bug_id)
    if (!byId) {
      byId = new Map()
      byBug.set(attachment.bug_id, byId)
    }
    byId.set(attachment.id, { attachment, seq })
  }
  for (const listener of completedListeners) listener(ws, attachment)
}

function beginFetch(ws: string): number {
  const seq = ++syncSeq
  let set = fetchesInFlight.get(ws)
  if (!set) {
    set = new Set()
    fetchesInFlight.set(ws, set)
  }
  set.add(seq)
  return seq
}

/** Retained attachments completed after the fetch started at `startSeq` (it may lack them). */
function retainedSince(ws: string, startSeq: number): (bugId: string) => BugAttachment[] {
  const byBug = retainedCompleted.get(ws)
  const out = new Map<string, BugAttachment[]>()
  for (const [bugId, byId] of byBug ?? []) {
    const list = [...byId.values()].filter((r) => r.seq > startSeq).map((r) => r.attachment)
    if (list.length) out.set(bugId, list)
  }
  return (bugId) => out.get(bugId) ?? []
}

/**
 * Ends a fetch (applied or not). Entries no remaining in-flight fetch predates are dropped:
 * everything once none is in flight, else those with seq ≤ the oldest remaining fetch start.
 */
function endFetch(ws: string, startSeq: number): void {
  const inflight = fetchesInFlight.get(ws)
  inflight?.delete(startSeq)
  if (inflight && inflight.size === 0) fetchesInFlight.delete(ws)
  const byBug = retainedCompleted.get(ws)
  if (!byBug) return
  if (!inflight?.size) {
    retainedCompleted.delete(ws)
    return
  }
  const oldestInFlight = Math.min(...inflight)
  for (const [bugId, byId] of byBug) {
    for (const [id, r] of byId) {
      if (r.seq <= oldestInFlight) byId.delete(id)
    }
    if (byId.size === 0) byBug.delete(bugId)
  }
  if (byBug.size === 0) retainedCompleted.delete(ws)
}

/** Test helper: number of completed uploads retained for a workspace. */
export function retainedUploadCount(ws: string): number {
  let n = 0
  for (const byId of retainedCompleted.get(ws)?.values() ?? []) n += byId.size
  return n
}

function subscribeCompleted(listener: CompletedListener): () => void {
  completedListeners.add(listener)
  return () => {
    completedListeners.delete(listener)
  }
}

/** Test helper: drop all pending-upload state. */
export function resetPendingUploads(): void {
  const workspaces = [...pendingFiles.keys()]
  pendingFiles.clear()
  retainedCompleted.clear()
  fetchesInFlight.clear()
  mountedHooks.clear()
  for (const ws of workspaces) publishPending(ws)
}

/**
 * Edits of one field, in issue order. Failed edits are removed; the shown value is that of the
 * latest remaining edit (outstanding or confirmed), else `original`.
 */
interface FieldEdits {
  original: unknown
  edits: { mut: number; value: unknown; confirmed: boolean }[]
}

function shownValue(f: FieldEdits): unknown {
  const last = f.edits[f.edits.length - 1]
  return last ? last.value : f.original
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
  const [loadError, setLoadError] = useState<{ workspaceId: string; message: string } | null>(null)
  const reloadRef = useRef<(() => void) | null>(null)
  const [state, setState] = useState<ListState>({ workspaceId, bugs: [], loaded: false })
  /** Workspace whose list is live. Async results for any other workspace are dropped. */
  const liveWsRef = useRef<string | null>(null)
  const reload = useCallback(() => {
    if (liveWsRef.current === workspaceId) reloadRef.current?.()
  }, [workspaceId])
  const selfIdRef = useRef<string | null>(null)
  /** Ids of bugs filed from this hook instance (never announced as remote inserts). */
  const localIdsRef = useRef(new Set<string>())
  /** Changes seen since the latest list fetch started (see SnapshotOptions.isRecent). */
  const touchedRef = useRef(new Set<string>())
  /** Bugs deleted here or remotely; a fetch or event already under way must not bring them back. */
  const deletedRef = useRef(new Set<string>())
  const onRemoteInsertRef = useRef(opts?.onRemoteInsert)
  const bugsRef = useRef<BugWithMeta[]>(EMPTY)
  /** Optimistic edits per bug id → field, while any edit of that field is outstanding. */
  const fieldEditsRef = useRef(new Map<string, Map<keyof BugWithMeta, FieldEdits>>())
  const mutationSeqRef = useRef(0)

  const pendingByBug = useSyncExternalStore(
    subscribePending,
    () => pendingSnapshots.get(workspaceId) ?? NO_PENDING,
    () => NO_PENDING,
  )

  const current = state.workspaceId === workspaceId
  const listBugs = current ? state.bugs : EMPTY
  const loading = !(current && state.loaded)
  const bugs = useMemo(() => {
    if (pendingByBug === NO_PENDING) return listBugs
    return listBugs.map((b) => {
      const pending = pendingByBug[b.id]
      return pending ? { ...b, pending } : b
    })
  }, [listBugs, pendingByBug])

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

  useEffect(
    () =>
      subscribeCompleted((ws, attachment) => {
        touchedRef.current.add(`att:${attachment.id}`)
        mutate(ws, (b) =>
          mapBug(b, attachment.bug_id, (bug) => {
            const attachments = mergeAttachments(bug.attachments, [attachment])
            return attachments === bug.attachments ? bug : { ...bug, attachments }
          }),
        )
      }),
    [mutate],
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
    mountedHooks.set(workspaceId, (mountedHooks.get(workspaceId) ?? 0) + 1)
    let active = true
    let latest = 0
    const touched = touchedRef.current
    const deleted = deletedRef.current

    const load = async () => {
      const seq = ++latest
      setLoadError(null)
      touched.clear()
      const startSeq = beginFetch(workspaceId)
      try {
        let fetched: BugWithMeta[]
        try {
          const { data, error } = await supabase
            .from('bugs')
            .select('*, bug_attachments(*)')
            .eq('workspace_id', workspaceId)
            .order('created_at', { ascending: false })
            .limit(FETCH_LIMIT)
          if (error) throw error
          fetched = (data ?? []).map(toBugWithMeta)
        } catch (err) {
          if (!active || seq !== latest) return
          console.error('Failed to load bugs', err)
          setLoadError({ workspaceId, message: "Couldn't load bugs" })
          mutate(workspaceId, (b) => b, true)
          return
        }
        if (!active || seq !== latest) return
        const recent = new Set(touched)
        const retained = retainedSince(workspaceId, startSeq)
        mutate(
          workspaceId,
          (b) =>
            applySnapshot(
              b,
              fetched.filter((f) => !deleted.has(f.id)),
              {
                truncated: fetched.length >= FETCH_LIMIT,
                isRecent: (key) => recent.has(key),
                retained,
              },
            ),
          true,
        )
      } finally {
        endFetch(workspaceId, startSeq)
      }
    }

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
          if (deleted.has(row.id)) return
          touched.add(`bug:${row.id}`)
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
          if (deleted.has(row.id)) return
          touched.add(`bug:${row.id}`)
          mutate(workspaceId, (b) => upsertRow(b, row))
        },
      )
      // DELETE events cannot be filtered by column, so this sees every workspace's deletions.
      .on<BugRow>(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'bugs' },
        (payload) => {
          if (!active) return
          const removedId = payload.old.id
          if (!removedId) return
          deleted.add(removedId)
          mutate(workspaceId, (b) => removeBug(b, removedId))
        },
      )
      .on<BugAttachment>(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'bug_attachments' },
        (payload) => {
          if (!active) return
          const att = payload.new
          touched.add(`att:${att.id}`)
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
          touched.add(`del:${removedId}`)
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

    reloadRef.current = () => {
      setState((s) => (s.workspaceId === workspaceId ? { ...s, loaded: false } : s))
      void load()
    }

    // Fetch on every (re)SUBSCRIBED: the first is the initial load, later ones close the gap left
    // by a reconnect. If realtime never connects, fall back to one plain fetch so the list loads.
    let everSubscribed = false
    let fallbackDone = false
    channel.subscribe((status) => {
      if (!active) return
      if (status === 'SUBSCRIBED') {
        everSubscribed = true
        void load()
      } else if (
        (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') &&
        !everSubscribed &&
        !fallbackDone
      ) {
        fallbackDone = true
        void load()
      }
    })

    return () => {
      active = false
      if (liveWsRef.current === workspaceId) {
        liveWsRef.current = null
        reloadRef.current = null
      }
      const mounted = (mountedHooks.get(workspaceId) ?? 1) - 1
      if (mounted > 0) mountedHooks.set(workspaceId, mounted)
      else {
        mountedHooks.delete(workspaceId)
        retainedCompleted.delete(workspaceId)
      }
      void supabase.removeChannel(channel)
    }
  }, [workspaceId, mutate])

  const runUploads = useCallback(async (ws: string, bugId: string, from: 'queued' | 'failed') => {
    // Claim synchronously (before any await) so concurrent callers never take the same file.
    const claimed = (pendingFiles.get(ws)?.get(bugId) ?? []).filter((f) => f.status === from)
    if (claimed.length === 0) return
    for (const item of claimed) {
      item.status = 'uploading'
      item.progress = 0
      item.error = undefined
    }
    publishPending(ws)

    for (const item of claimed) {
      try {
        const image = await compressImage(item.file)
        let attachment: BugAttachment
        try {
          attachment = await uploadAttachment({
            workspaceId: ws,
            bugId,
            image,
            onProgress: (p) => {
              item.progress = p
              publishPending(ws)
            },
          })
        } finally {
          if (image.previewUrl) URL.revokeObjectURL(image.previewUrl)
        }
        // Through the shared store, so whichever hook instance is mounted now (even after a
        // remount) merges the attachment.
        publishCompleted(ws, attachment)
        removePending(ws, bugId, item.localId)
        URL.revokeObjectURL(item.previewUrl)
      } catch (err) {
        item.status = 'failed'
        item.error = friendlyError(err, 'Upload failed.')
        publishPending(ws)
      }
    }
  }, [])

  const fileBug = useCallback(
    async (input: NewBugInput, opts?: { onOptimistic?: (id: string) => void }) => {
      const ws = workspaceId
      const filedBy = await requireUserId()
      selfIdRef.current = filedBy
      const id = randomId()
      const now = new Date().toISOString()
      const title =
        deriveTitle(input.description) ||
        deriveTitle(input.transcript ?? '') ||
        (input.kind === 'feature' ? 'Untitled feature' : 'Untitled bug')
      const description = input.description.trim()
      const transcript = input.transcript?.trim() ? input.transcript.trim() : null

      const files: PendingFile[] = input.files.map((file) => ({
        localId: randomId(),
        previewUrl: URL.createObjectURL(file),
        progress: 0,
        file,
        status: 'queued',
      }))
      localIdsRef.current.add(id)
      touchedRef.current.add(`bug:${id}`)
      if (files.length) setPending(ws, id, files)

      const optimistic: BugWithMeta = {
        id,
        workspace_id: ws,
        number: 0,
        title,
        description,
        transcript,
        severity: input.severity,
        status: 'open',
        kind: input.kind,
        filed_by: filedBy,
        created_at: now,
        resolved_by: null,
        resolved_at: null,
        resolution_note: null,
        assignee_id: null,
        updated_at: now,
        attachments: [],
        optimistic: true,
      }
      mutate(ws, (b) => [optimistic, ...b.filter((x) => x.id !== id)])
      opts?.onOptimistic?.(id)

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
            kind: input.kind,
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
        removePending(ws, id)
        localIdsRef.current.delete(id)
        for (const f of files) URL.revokeObjectURL(f.previewUrl)
        throw new Error(friendlyError(failure, 'Could not file the bug. Try again.'))
      }

      const row = inserted
      touchedRef.current.add(`bug:${id}`)
      // Same path as realtime rows: a newer UPDATE already applied is not overwritten.
      mutate(ws, (b) => upsertRow(b, row))
      if (files.length) void runUploads(ws, id, 'queued')
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
      const mut = ++mutationSeqRef.current
      const fields = Object.keys(optimisticPatch) as (keyof BugWithMeta)[]
      let byField = fieldEditsRef.current.get(id)
      if (!byField) {
        byField = new Map()
        fieldEditsRef.current.set(id, byField)
      }
      for (const f of fields) {
        let entry = byField.get(f)
        if (!entry) {
          entry = { original: before?.[f], edits: [] }
          byField.set(f, entry)
        }
        entry.edits.push({ mut, value: optimisticPatch[f], confirmed: false })
      }
      mutate(ws, (b) => mapBug(b, id, (bug) => ({ ...bug, ...optimisticPatch })))

      let failure: unknown
      try {
        const { error } = await supabase.from('bugs').update(dbPatch).eq('id', id)
        failure = error
      } catch (err) {
        failure = err
      }

      // Settle this edit: drop it on failure, mark it confirmed on success; then show the latest
      // remaining edit of each field (or the original once none remain).
      const shown: Partial<Record<keyof BugWithMeta, unknown>> = {}
      for (const f of fields) {
        const entry = byField.get(f)
        if (!entry) continue
        const idx = entry.edits.findIndex((e) => e.mut === mut)
        if (idx === -1) continue
        if (failure) entry.edits.splice(idx, 1)
        else entry.edits[idx].confirmed = true
        shown[f] = shownValue(entry)
        if (entry.edits.every((e) => e.confirmed)) byField.delete(f)
      }
      if (byField.size === 0 && fieldEditsRef.current.get(id) === byField) {
        fieldEditsRef.current.delete(id)
      }
      if (before && Object.keys(shown).length) {
        const patch = shown as Partial<BugWithMeta>
        // Only while no newer server row has been applied since this edit was made (a server row
        // carries the authoritative value of every field).
        mutate(ws, (b) =>
          mapBug(b, id, (bug) => {
            if (bug.updated_at !== before.updated_at) return bug
            const changed = (Object.keys(patch) as (keyof BugWithMeta)[]).some(
              (k) => bug[k] !== patch[k],
            )
            return changed ? { ...bug, ...patch } : bug
          }),
        )
      }
      if (!failure) return
      throw new Error(friendlyError(failure, 'Could not save changes.'))
    },
    [workspaceId, mutate],
  )

  const updateBug = useCallback(
    (id: string, patch: Partial<Pick<Bug, 'title' | 'description' | 'severity' | 'kind'>>) =>
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

  /** Assigns the bug to a workspace member, or unassigns it with null (server: assignee_not_member). */
  const assignBug = useCallback(
    async (id: string, userId: string | null) => {
      await patchBug(id, { assignee_id: userId }, { assignee_id: userId })
    },
    [patchBug],
  )

  const deleteBug = useCallback(
    async (id: string) => {
      const ws = workspaceId
      // The row goes first, so a refused delete never costs the bug its screenshots.
      const { data, error } = await supabase.from('bugs').delete().eq('id', id).select('id')
      if (error) throw new Error(friendlyError(error, 'Could not delete the bug.'))
      if (!data?.length) throw new Error('Could not delete the bug. Try again.')
      deletedRef.current.add(id)
      mutate(ws, (b) => removeBug(b, id))
      for (const f of pendingFiles.get(ws)?.get(id) ?? []) URL.revokeObjectURL(f.previewUrl)
      removePending(ws, id)
      // Best effort: the bug is already gone, so a failure here only leaves orphaned files.
      try {
        await removeScreenshots(`${ws}/${id}`)
      } catch (err) {
        console.error('Failed to remove screenshots of deleted bug', err)
      }
    },
    [workspaceId, mutate],
  )

  const retryUploads = useCallback(
    (bugId: string) => runUploads(workspaceId, bugId, 'failed'),
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
      mutate(ws, (b) => mergeRows(b, [bug]))
      return bug
    },
    [workspaceId, mutate],
  )

  const counts = useMemo(() => countBugs(bugs), [bugs])

  return {
    bugs,
    loading,
    error: loadError?.workspaceId === workspaceId ? loadError.message : null,
    reload,
    counts,
    fileBug,
    updateBug,
    resolveBug,
    reopenBug,
    assignBug,
    deleteBug,
    retryUploads,
    getBugByNumber,
  }
}
