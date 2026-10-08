import {
  useCallback,
  useEffect,
  useEffectEvent,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type ReactNode,
  type RefObject,
} from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  Bug as BugIcon,
  CircleCheck,
  CircleDot,
  Layers,
  Lightbulb,
  Lock,
  MousePointerClick,
  Search,
  SearchX,
  SquarePen,
  Trash2,
  UserRound,
  type LucideIcon,
} from 'lucide-react'
import { BugDetail, BugDetailSkeleton } from '../components/BugDetail'
import { BugList } from '../components/BugList'
import { CaptureBar } from '../components/CaptureBar'
import { Header } from '../components/Header'
import { InviteDialog } from '../components/InviteDialog'
import { ConnectionStatus } from '../components/ConnectionStatus'
import { HINT_ROW, StatePanel } from '../components/EmptyState'
import { Onboarding } from '../components/GettingStarted'
import { isFirstItemView, onboardingSteps } from '../lib/onboarding'
import { PaneSplitter } from '../components/PaneSplitter'
import { useListWidth } from '../lib/listWidth'
import { Skeleton } from '../components/Skeleton'
import { Button, ButtonLink, Kbd } from '../components/ui'
import { ShortcutsSheet } from '../components/ShortcutsSheet'
import { useToast } from '../components/Toast'
import { countBugs, filterBugs, hasActiveFilters, sortBugs, useBugs } from '../hooks/useBugs'
import { useUrlFilters, writeFilters } from '../hooks/useUrlFilters'
import { ClaudeSetupDialog } from '../components/ClaudeSetupDialog'
import { CommandPalette, type Command } from '../components/CommandPalette'
import { useClaudeExport } from '../hooks/useClaudeExport'
import { useClaudeResults } from '../hooks/useClaudeResults'
import { isOverlayOpen, useOverlayOpen, useShortcut } from '../hooks/useKeyboard'
import { usePresence } from '../hooks/usePresence'
import { useNotifications } from '../hooks/useNotifications'
import { useUnreadTitle } from '../hooks/useUnreadTitle'
import { setLastWorkspace, useWorkspace, useWorkspaces } from '../hooks/useWorkspaces'
import { useAuth } from '../lib/auth'
import { AUTO_RESOLVE_VERSION } from '../lib/claudeExport'
import { bugsToCsv, bugsToMarkdown, downloadText, exportFilename } from '../lib/export'
import { supabase } from '../lib/supabase'
import { NEXT_THEME, useTheme } from '../lib/theme'
import type { Bug, BugKind, BugWithMeta } from '../lib/types'
import { cn, isMac } from '../lib/utils'

const HIGHLIGHT_MS = 3000

/** Who made the latest assignment change on a bug, from its activity log. */
async function lastAssigner(bugId: string, userId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('bug_events')
    .select('actor_id')
    .eq('bug_id', bugId)
    .eq('type', 'assigned')
    .eq('note', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw error
  return data?.actor_id ?? null
}

/**
 * List and detail sit side by side from 1024px (Tailwind `lg`); below that the workspace is one
 * pane at a time (list → detail), so nothing is squeezed at tablet widths.
 */
function isDesktop(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia('(min-width: 1024px)').matches
}

function subscribeDesktop(onChange: () => void): () => void {
  if (typeof window.matchMedia !== 'function') return () => {}
  const query = window.matchMedia('(min-width: 1024px)')
  query.addEventListener('change', onChange)
  return () => query.removeEventListener('change', onChange)
}

/** isDesktop() as state, for what renders differently side by side (follows window resizes). */
function useDesktop(): boolean {
  return useSyncExternalStore(subscribeDesktop, isDesktop, () => false)
}

/**
 * The bug detail column (BugDetail's article): 760px of content between 48px gutters, centred in
 * the detail pane. Detail-pane empty states use it too, so they sit where a bug would.
 */
const DETAIL_COLUMN = 'mx-auto w-full max-w-[856px]'

export default function Workspace() {
  const { workspaceId = '', number: numberParam } = useParams<{
    workspaceId: string
    number?: string
  }>()
  const navigate = useNavigate()
  const { search } = useLocation()
  const { user } = useAuth()
  const selfId = user?.id ?? ''
  const { toast } = useToast()
  const ws = useWorkspace(workspaceId)
  const { workspaces } = useWorkspaces()
  const { notify } = useNotifications()
  const [unreadCount, setUnreadCount] = useState(0)
  useUnreadTitle(unreadCount)
  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') setUnreadCount(0)
    }
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => document.removeEventListener('visibilitychange', onVisibilityChange)
  }, [])

  const [highlightIds, setHighlightIds] = useState<Set<string>>(() => new Set())
  const highlightTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>())
  useEffect(() => {
    const timers = highlightTimers.current
    return () => {
      for (const t of timers.values()) clearTimeout(t)
      timers.clear()
    }
  }, [])

  const onRemoteInsert = (bug: Bug) => {
    if (bug.filed_by !== selfId) {
      const name =
        ws.members.find((m) => m.user_id === bug.filed_by)?.profile.display_name ?? 'Someone'
      const title = `${name} filed ${bug.kind === 'feature' ? 'feature ' : ''}#${bug.number}`
      toast(title)
      notify({
        title,
        body: bug.title,
        tag: bug.id,
        onClick: () => navigate(`/app/${workspaceId}/bug/${bug.number}${search}`),
      })
      if (document.visibilityState !== 'visible') setUnreadCount((count) => count + 1)
    }
    setHighlightIds((prev) => new Set(prev).add(bug.id))
    const timers = highlightTimers.current
    const existing = timers.get(bug.id)
    if (existing !== undefined) clearTimeout(existing)
    timers.set(
      bug.id,
      setTimeout(() => {
        timers.delete(bug.id)
        setHighlightIds((prev) => {
          const next = new Set(prev)
          next.delete(bug.id)
          return next
        })
      }, HIGHLIGHT_MS),
    )
  }

  const {
    bugs,
    loading,
    error,
    reload,
    fileBug,
    updateBug,
    resolveBug,
    reopenBug,
    assignBug,
    deleteBug,
    retryUploads,
    getBugByNumber,
  } = useBugs(workspaceId, { onRemoteInsert })

  // Assignment changes this tab made (in flight, or just rolled back after a failure), so their
  // optimistic updates and rollbacks are never announced as a teammate's assignment.
  const localAssigns = useRef(new Map<string, number>())
  const rolledBack = useRef(new Set<string>())
  const assign = useCallback(
    async (id: string, userId: string | null) => {
      const inFlight = localAssigns.current
      inFlight.set(id, (inFlight.get(id) ?? 0) + 1)
      try {
        await assignBug(id, userId)
      } catch (err) {
        rolledBack.current.add(id)
        throw err
      } finally {
        const left = (inFlight.get(id) ?? 1) - 1
        if (left > 0) inFlight.set(id, left)
        else inFlight.delete(id)
      }
    },
    [assignBug],
  )

  function toastUndo(message: string, undo: () => Promise<void>) {
    toast(message, {
      tone: 'success',
      action: {
        label: 'Undo',
        onAction: () => {
          void undo().catch((err: unknown) => {
            toast(err instanceof Error ? err.message : 'Could not undo the change.', {
              tone: 'error',
            })
          })
        },
      },
    })
  }

  async function resolveWithUndo(id: string, note: string | null) {
    const before = bugs.find((bug) => bug.id === id)
    await resolveBug(id, note)
    if (before && before.status === 'open')
      toastUndo(`Resolved #${before.number}`, () => reopenBug(id, before.resolution_note))
  }

  async function reopenWithUndo(id: string, note: string | null) {
    const before = bugs.find((bug) => bug.id === id)
    await reopenBug(id, note)
    if (before && before.status === 'resolved')
      toastUndo(`Reopened #${before.number}`, () => resolveBug(id, before.resolution_note))
  }

  // The check-off circle on a list row: resolve (no note) or reopen in one click, with Undo.
  // Stable across renders so memoised rows do not redraw; it reads the latest handlers.
  const toggleStatusRef = useRef<(bug: BugWithMeta) => Promise<void>>(async () => {})
  useEffect(() => {
    toggleStatusRef.current = (bug) =>
      bug.status === 'resolved'
        ? reopenWithUndo(bug.id, bug.resolution_note)
        : resolveWithUndo(bug.id, null)
  })
  const toggleStatus = useCallback(
    (bug: BugWithMeta) => {
      void toggleStatusRef.current(bug).catch((err: unknown) => {
        toast(err instanceof Error ? err.message : 'Could not update the status.', {
          tone: 'error',
        })
      })
    },
    [toast],
  )

  async function assignWithUndo(id: string, userId: string | null) {
    const before = bugs.find((bug) => bug.id === id)
    await assign(id, userId)
    if (before && before.assignee_id !== userId)
      toastUndo(`${userId ? 'Assigned' : 'Unassigned'} #${before.number}`, () =>
        assign(id, before.assignee_id),
      )
  }

  async function updateWithUndo(id: string, patch: Parameters<typeof updateBug>[1]) {
    const before = bugs.find((bug) => bug.id === id)
    await updateBug(id, patch)
    if (before && patch.severity !== undefined && patch.severity !== before.severity)
      toastUndo(`Changed severity of #${before.number}`, () =>
        updateBug(id, { severity: before.severity }),
      )
  }

  // Replaced per workspace (and on unmount) so pending assigner lookups go quiet.
  const announceLive = useRef({ current: true })
  useEffect(() => {
    const live = { current: true }
    announceLive.current = live
    return () => {
      live.current = false
    }
  }, [workspaceId])

  const announceAssignment = useEffectEvent((bug: Bug) => {
    const live = announceLive.current
    void lastAssigner(bug.id, selfId)
      .catch((err: unknown) => {
        console.error('Failed to load who assigned the bug', err)
        return null
      })
      .then((actorId) => {
        if (!live.current || actorId === selfId) return
        const name =
          ws.members.find((m) => m.user_id === actorId)?.profile.display_name ?? 'Someone'
        const title = `${name} assigned you #${bug.number}`
        toast(title)
        notify({
          title,
          body: bug.title,
          tag: `assigned:${bug.id}`,
          onClick: () => navigate(`/app/${workspaceId}/bug/${bug.number}${search}`),
        })
        if (document.visibilityState !== 'visible') setUnreadCount((count) => count + 1)
      })
  })

  // Realtime updates carry no actor, so an assignment to the signed-in user is spotted by
  // comparing each bug's assignee with the previous render's.
  const prevAssignees = useRef<Map<string, string | null> | null>(null)
  useEffect(() => {
    const prev = prevAssignees.current
    prevAssignees.current = new Map(bugs.map((b) => [b.id, b.assignee_id]))
    const local = (id: string) => localAssigns.current.has(id) || rolledBack.current.has(id)
    if (prev && selfId !== '') {
      for (const bug of bugs) {
        if (bug.assignee_id !== selfId || !prev.has(bug.id) || prev.get(bug.id) === selfId) continue
        if (bug.optimistic || local(bug.id)) continue
        announceAssignment(bug)
      }
    }
    // A rollback is seen by at most the next update after the failure.
    rolledBack.current.clear()
  }, [bugs, selfId])

  const [filters, setFilters] = useUrlFilters()
  const [pickedIds, setPickedIds] = useState<Set<string>>(() => new Set())
  const togglePick = useCallback((id: string) => {
    setPickedIds((prev) => {
      const next = new Set(prev)
      if (!next.delete(id)) next.add(id)
      return next
    })
  }, [])
  const clearPicked = useCallback(() => setPickedIds(new Set()), [])
  const claude = useClaudeExport(workspaceId, ws.workspace?.name ?? '', ws.members, toast)
  useClaudeResults(
    workspaceId,
    (claude.status?.version ?? 0) >= AUTO_RESOLVE_VERSION,
    { getBugByNumber, resolveBug },
    toast,
  )
  /** Selection of an optimistic bug (no number yet, so it cannot live in the URL). */
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [lookupMissing, setLookupMissing] = useState<number | null>(null)
  const [resolveRequest, setResolveRequest] = useState(0)
  const [reopenRequest, setReopenRequest] = useState(0)
  const [assignRequest, setAssignRequest] = useState(0)
  const [inviteOpen, setInviteOpen] = useState(false)
  const [shortcutsOpen, setShortcutsOpen] = useState(false)
  const [paletteOpen, setPaletteOpen] = useState(false)
  const { theme, setTheme } = useTheme()
  const [listWidth, setListWidth, resetListWidth] = useListWidth()
  const desktop = useDesktop()
  const captureRef = useRef<HTMLTextAreaElement | null>(null)
  const searchRef = useRef<HTMLInputElement | null>(null)

  const hasNumberParam = numberParam !== undefined
  const parsedNumber =
    numberParam !== undefined && /^[1-9]\d*$/.test(numberParam) ? Number(numberParam) : null
  const selected =
    (hasNumberParam
      ? bugs.find((b) => b.number === parsedNumber && !b.optimistic)
      : pendingId
        ? bugs.find((b) => b.id === pendingId)
        : undefined) ?? null
  const found = selected !== null
  // Once a pending (optimistic) selection has moved into the URL, the URL owns it.
  if (pendingId !== null && hasNumberParam && selected?.id === pendingId) setPendingId(null)
  const notFound =
    hasNumberParam && !found && (parsedNumber === null || lookupMissing === parsedNumber)
  const showDetail = hasNumberParam || found

  const basePath = `/app/${workspaceId}`
  const listPath = `${basePath}${search}`
  const bugPath = useCallback(
    (n: number) => `/app/${workspaceId}/bug/${n}${search}`,
    [workspaceId, search],
  )

  const presence = usePresence(workspaceId, selected?.id ?? null)

  // The list follows the open item's kind: a deep link to a feature request (or moving the open
  // item between Bugs and Features) switches the list to match.
  const selectedKind = selected?.kind ?? null
  const [followedKind, setFollowedKind] = useState<BugKind | null>(null)
  if (selectedKind !== followedKind) {
    setFollowedKind(selectedKind)
    if (selectedKind !== null && selectedKind !== filters.kind) setPickedIds(new Set())
  }
  useEffect(() => {
    if (selectedKind === null) return
    setFilters((f) => (f.kind === selectedKind ? f : { ...f, kind: selectedKind }), {
      replace: true,
    })
  }, [selectedKind, setFilters])

  useEffect(() => {
    if (ws.workspace) setLastWorkspace(ws.workspace.id)
  }, [ws.workspace])

  // Deep link to a bug outside the loaded list: fetch it once by number.
  useEffect(() => {
    if (parsedNumber === null || loading || found) return
    let cancelled = false
    getBugByNumber(parsedNumber).then(
      (bug) => {
        if (!cancelled && !bug) setLookupMissing(parsedNumber)
      },
      (err: unknown) => {
        if (cancelled) return
        setLookupMissing(parsedNumber)
        toast(err instanceof Error ? err.message : 'Could not load that bug.')
      },
    )
    return () => {
      cancelled = true
    }
  }, [parsedNumber, loading, found, getBugByNumber, toast])

  // An optimistic selection moves into the URL once the server assigns its number.
  const pendingNumber =
    !hasNumberParam && pendingId ? (bugs.find((b) => b.id === pendingId)?.number ?? 0) : 0
  useEffect(() => {
    if (pendingNumber > 0) navigate(bugPath(pendingNumber), { replace: true })
  }, [pendingNumber, bugPath, navigate])

  const select = useCallback(
    (id: string, opts?: { replace?: boolean }) => {
      const bug = bugs.find((b) => b.id === id)
      if (!bug) return
      if (bug.optimistic || bug.number === 0) {
        setPendingId(id)
        if (hasNumberParam) navigate(listPath, { replace: opts?.replace })
        return
      }
      setPendingId(null)
      navigate(bugPath(bug.number), { replace: opts?.replace })
    },
    [bugs, hasNumberParam, navigate, listPath, bugPath],
  )

  // A newly filed item opens right away: it is optimistic (no number yet), so it is held as the
  // pending selection and moves into the URL once the server assigns its number.
  const fileAndSelect = useCallback(
    async (input: Parameters<typeof fileBug>[0]) => {
      let newId: string | null = null
      try {
        await fileBug(input, {
          onOptimistic: (id) => {
            newId = id
            setPendingId(id)
            if (hasNumberParam) navigate(listPath)
          },
        })
      } catch (err) {
        if (newId !== null) setPendingId((p) => (p === newId ? null : p))
        throw err
      }
    },
    [fileBug, hasNumberParam, navigate, listPath],
  )

  const deselect = useCallback(() => {
    setPendingId(null)
    if (hasNumberParam) navigate(listPath)
  }, [hasNumberParam, navigate, listPath])

  const sorted = useMemo(() => sortBugs(bugs, filters.sort), [bugs, filters.sort])
  const visible = useMemo(() => filterBugs(sorted, filters), [sorted, filters])

  /** A bug whose list row takes focus once it is selected (after deleting the one before it). */
  const focusRowOf = useRef<string | null>(null)
  // After a delete the user keeps their place: the next bug in the list opens (or the previous
  // one when the deleted bug was last) and its row takes focus. Nothing left: the empty state.
  const deleteAndAdvance = useCallback(
    async (id: string) => {
      const bug = bugs.find((b) => b.id === id)
      const at = visible.findIndex((b) => b.id === id)
      const neighbour = at === -1 ? undefined : (visible[at + 1] ?? visible[at - 1])
      await deleteBug(id)
      setPickedIds((prev) => {
        if (!prev.has(id)) return prev
        const next = new Set(prev)
        next.delete(id)
        return next
      })
      // No Undo: a delete is final (the row and its screenshots are gone; the deletion log in
      // Settings only records it). The icon matches the other confirmation toasts.
      if (bug)
        toast(`Deleted ${bug.kind === 'feature' ? 'feature ' : ''}#${bug.number}`, {
          icon: <Trash2 size={16} absoluteStrokeWidth strokeWidth={1.5} className="text-ink-2" />,
        })
      if (neighbour) {
        focusRowOf.current = neighbour.id
        select(neighbour.id, { replace: true })
      } else {
        deselect()
      }
    },
    [bugs, visible, deleteBug, toast, select, deselect],
  )
  useEffect(() => {
    const id = focusRowOf.current
    if (id === null || selected?.id !== id) return
    focusRowOf.current = null
    // The list is hidden behind the detail on phones; focus the page there instead.
    const row = document.querySelector<HTMLElement>(
      '#bug-list-pane [role="option"][aria-selected="true"]',
    )
    if (row && isDesktop()) row.focus()
    else document.getElementById('main')?.focus()
  }, [selected?.id])

  const effectivePickedIds = new Set(
    visible.filter((bug) => pickedIds.has(bug.id)).map((bug) => bug.id),
  )
  if (effectivePickedIds.size !== pickedIds.size) setPickedIds(effectivePickedIds)
  const counts = useMemo(() => countBugs(bugs, filters.kind), [bugs, filters.kind])
  const openByKind = useMemo(
    () => ({ bug: countBugs(bugs, 'bug').open, feature: countBugs(bugs, 'feature').open }),
    [bugs],
  )

  const step = (dir: 1 | -1) => {
    if (visible.length === 0) return
    const idx = selected ? visible.findIndex((b) => b.id === selected.id) : -1
    const nextIdx =
      idx === -1
        ? dir > 0
          ? 0
          : visible.length - 1
        : Math.min(visible.length - 1, Math.max(0, idx + dir))
    if (nextIdx === idx) return
    select(visible[nextIdx].id, { replace: idx !== -1 })
  }

  /** Input to focus once the mobile list view has committed (N and / from the detail view). */
  const pendingFocus = useRef<RefObject<HTMLElement | null> | null>(null)
  useEffect(() => {
    if (showDetail || !pendingFocus.current) return
    pendingFocus.current.current?.focus()
    pendingFocus.current = null
  }, [showDetail])
  const focusInList = (target: RefObject<HTMLElement | null>) => {
    if (showDetail && !isDesktop()) {
      pendingFocus.current = target
      deselect()
      return
    }
    target.current?.focus()
  }

  useOverlayOpen(inviteOpen)
  const shortcutsEnabled =
    !inviteOpen && !shortcutsOpen && !paletteOpen && !claude.setupOpen && ws.workspace !== null

  const workspaceReady = ws.workspace !== null
  useEffect(() => {
    if (!workspaceReady) return
    function onKey(e: KeyboardEvent) {
      if (e.defaultPrevented || e.isComposing || e.altKey || e.shiftKey) return
      if (e.key.toLowerCase() !== 'k' || !(isMac ? e.metaKey : e.ctrlKey)) return
      e.preventDefault()
      setPaletteOpen((open) => {
        if (open) return false
        return !isOverlayOpen()
      })
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [workspaceReady])

  const opts = { enabled: shortcutsEnabled }
  useShortcut(
    'n',
    (e) => {
      e.preventDefault()
      focusInList(captureRef)
    },
    opts,
  )
  useShortcut(
    '/',
    (e) => {
      e.preventDefault()
      focusInList(searchRef)
    },
    opts,
  )
  useShortcut(
    'j',
    (e) => {
      e.preventDefault()
      step(1)
    },
    opts,
  )
  useShortcut(
    'k',
    (e) => {
      e.preventDefault()
      step(-1)
    },
    opts,
  )
  useShortcut(
    'r',
    (e) => {
      if (!selected || selected.optimistic || selected.status !== 'open') return
      e.preventDefault()
      setResolveRequest((n) => n + 1)
    },
    opts,
  )
  useShortcut(
    'o',
    (e) => {
      if (!selected || selected.optimistic || selected.status !== 'resolved') return
      e.preventDefault()
      setReopenRequest((n) => n + 1)
    },
    opts,
  )
  useShortcut(
    'a',
    (e) => {
      if (!selected || selected.optimistic) return
      e.preventDefault()
      setAssignRequest((n) => n + 1)
    },
    opts,
  )
  const unassign = (bug: Bug) => {
    void assignWithUndo(bug.id, null).catch((err: unknown) =>
      toast(err instanceof Error ? err.message : 'Could not change the assignee.', {
        tone: 'error',
      }),
    )
  }
  const toggleSelfAssign = (bug: Bug) => {
    if (bug.assignee_id === selfId) {
      unassign(bug)
      return
    }
    void assignWithUndo(bug.id, selfId).catch((err: unknown) =>
      toast(err instanceof Error ? err.message : 'Could not change the assignee.', {
        tone: 'error',
      }),
    )
  }
  useShortcut(
    'i',
    (e) => {
      if (!selected || selected.optimistic || selfId === '') return
      e.preventDefault()
      toggleSelfAssign(selected)
    },
    opts,
  )
  useShortcut(
    'x',
    (e) => {
      if (!selected || selected.optimistic) return
      e.preventDefault()
      togglePick(selected.id)
    },
    opts,
  )
  useShortcut(
    'c',
    (e) => {
      const picked = visible.filter((b) => effectivePickedIds.has(b.id))
      const target = picked.length > 0 ? picked : selected ? [selected] : []
      if (target.length === 0) return
      e.preventDefault()
      claude.sendBugs(target)
    },
    opts,
  )
  useShortcut(
    'Escape',
    () => {
      if (showDetail && !isDesktop()) deselect()
    },
    opts,
  )
  useShortcut(
    '?',
    (e) => {
      e.preventDefault()
      setShortcutsOpen(true)
    },
    opts,
  )

  const applyFilters = (next: typeof filters) => {
    // Switching between Bugs and Features starts fresh: no picks, nothing open.
    if (next.kind !== filters.kind) {
      clearPicked()
      setPendingId(null)
      if (hasNumberParam) {
        navigate({
          pathname: basePath,
          search: writeFilters(new URLSearchParams(search), next).toString(),
        })
        return
      }
    }
    setFilters(next)
  }

  const commands: Command[] = [
    {
      id: 'new',
      label: filters.kind === 'feature' ? 'New feature request' : 'New bug',
      group: 'Actions',
      hint: 'N',
      icon: SquarePen,
      keywords: ['file', 'capture', 'report'],
      run: () => focusInList(captureRef),
    },
    {
      id: 'search',
      label: 'Search',
      group: 'Actions',
      hint: '/',
      icon: Search,
      keywords: ['find', 'filter'],
      run: () => focusInList(searchRef),
    },
    ...(selected && !selected.optimistic && selfId !== '' && selected.assignee_id !== selfId
      ? [
          {
            id: 'assign-me',
            label: 'Assign to me',
            group: 'Actions',
            hint: 'I',
            keywords: ['assignee', 'take', 'claim'],
            run: () => toggleSelfAssign(selected),
          },
        ]
      : []),
    ...(selected && !selected.optimistic && selected.assignee_id !== null
      ? [
          {
            id: 'unassign',
            label: 'Unassign',
            group: 'Actions',
            hint: selected.assignee_id === selfId ? 'I' : undefined,
            keywords: ['assignee', 'remove'],
            run: () => unassign(selected),
          },
        ]
      : []),
    ...(selfId !== ''
      ? [
          {
            id: 'filter-assigned-me',
            label: 'Show bugs assigned to me',
            group: 'Actions',
            icon: UserRound,
            keywords: ['assignee', 'mine', 'filter'],
            run: () => setFilters((f) => ({ ...f, assignee: selfId })),
          },
        ]
      : []),
    ...(
      [
        {
          id: 'nav-bugs',
          label: 'Show bugs',
          icon: BugIcon,
          next: { kind: 'bug' as const },
          words: ['kind'],
        },
        {
          id: 'nav-features',
          label: 'Show feature requests',
          icon: Lightbulb,
          next: { kind: 'feature' as const },
          words: ['kind', 'ideas'],
        },
        {
          id: 'nav-open',
          label: 'Show open',
          icon: CircleDot,
          next: { tab: 'open' as const },
          words: ['status'],
        },
        {
          id: 'nav-resolved',
          label: 'Show resolved',
          icon: CircleCheck,
          next: { tab: 'resolved' as const },
          words: ['status', 'closed', 'done'],
        },
        {
          id: 'nav-all',
          label: 'Show all',
          icon: Layers,
          next: { tab: 'all' as const },
          words: ['status'],
        },
      ] satisfies {
        id: string
        label: string
        icon: LucideIcon
        next: Partial<typeof filters>
        words: string[]
      }[]
    ).map(({ id, label, icon, next, words }): Command => ({
      id,
      label,
      icon,
      group: 'Navigate',
      keywords: ['filter', 'tab', ...words],
      run: () => {
        const nextFilters = { ...filters, ...next }
        if (showDetail && !isDesktop()) {
          // On phones the open bug hides the list; go back to it, carrying the new filters.
          if (nextFilters.kind !== filters.kind) clearPicked()
          setPendingId(null)
          navigate({
            pathname: basePath,
            search: writeFilters(new URLSearchParams(search), nextFilters).toString(),
          })
          return
        }
        applyFilters(nextFilters)
      },
    })),
    ...(['csv', 'md'] as const).map((format): Command => ({
      id: `export-${format}`,
      label: `Export visible bugs as ${format === 'csv' ? 'CSV' : 'Markdown'}`,
      group: 'Export',
      run: () => {
        if (!ws.workspace) return
        const name = ws.workspace.name
        downloadText(
          exportFilename(name, format),
          format === 'csv' ? bugsToCsv(visible) : bugsToMarkdown(visible, name),
          format === 'csv' ? 'text/csv;charset=utf-8' : 'text/markdown;charset=utf-8',
        )
      },
    })),
    ...visible
      .filter((b) => !b.optimistic && b.number > 0)
      .map((b): Command => ({
        id: `bug-${b.id}`,
        label: `#${b.number} ${b.title}`,
        accession: `#${b.number}`,
        group: b.kind === 'feature' ? 'Features' : 'Bugs',
        keywords: [String(b.number)],
        run: () => select(b.id),
      })),
    ...workspaces
      .filter((w) => w.id !== workspaceId)
      .map((w): Command => ({
        id: `ws-${w.id}`,
        label: `Switch to ${w.name}`,
        group: 'Switch workspace',
        keywords: ['workspace'],
        run: () => navigate(`/app/${w.id}`),
      })),
    {
      id: 'settings',
      label: 'Settings',
      group: 'Workspace',
      keywords: ['preferences', 'members', 'account'],
      run: () => navigate(`${basePath}/settings`),
    },
    {
      id: 'invite',
      label: 'Invite teammates',
      group: 'Workspace',
      keywords: ['members', 'share', 'link'],
      run: () => setInviteOpen(true),
    },
    {
      id: 'claude-setup',
      label: 'Set up Claude Code',
      group: 'Workspace',
      keywords: ['claude', 'bridge', 'helper', 'connect'],
      run: claude.openSetup,
    },
    {
      id: 'claude-guide',
      label: 'Claude Code guide',
      group: 'Help',
      keywords: ['claude', 'setup', 'docs'],
      run: () => navigate('/claude'),
    },
    {
      id: 'theme',
      label: 'Toggle theme',
      group: 'Preferences',
      keywords: ['dark', 'light', 'system', 'appearance'],
      run: () => setTheme(NEXT_THEME[theme]),
    },
    {
      id: 'shortcuts',
      label: 'Keyboard shortcuts',
      group: 'Help',
      hint: '?',
      keywords: ['keys', 'help'],
      keyboardOnly: true,
      run: () => setShortcutsOpen(true),
    },
  ]

  if (ws.notFound) {
    return (
      <main id="main" tabIndex={-1} className="min-h-screen bg-bg text-ink">
        <div className="mx-auto max-w-[40rem] pt-[18vh]">
          <StatePanel
            icon={Lock}
            title="You're not a member of this workspace"
            body="Ask a teammate for an invite link, or open one of your own workspaces."
            action={
              <ButtonLink to="/app" variant="secondary" size="sm">
                Go to your workspaces
              </ButtonLink>
            }
          />
        </div>
      </main>
    )
  }

  if (!ws.workspace) {
    return (
      <div role="status" aria-label="Loading workspace" className="paper-grain flex h-dvh flex-col">
        <span className="sr-only">Loading…</span>
        <div className="h-[3.4286rem] shrink-0 border-b border-line" />
        <div className="h-[4rem] shrink-0 border-b border-line" />
        <div
          className="min-h-0 flex-1 bg-surface-1 lg:w-(--list-w) lg:border-r lg:border-line"
          style={{ '--list-w': `${listWidth}px` } as CSSProperties}
        >
          <div className="h-[6.2857rem] border-b border-line" />
          <Skeleton />
        </div>
      </div>
    )
  }

  const workspace = ws.workspace
  const firstItem = isFirstItemView({
    loading,
    error: error ?? null,
    total: bugs.length,
    kindTotal: counts.all,
    visible: visible.length,
    filtered: hasActiveFilters(filters),
    tab: filters.tab,
  })

  let detail: ReactNode
  if (selected) {
    detail = (
      <BugDetail
        bug={selected}
        members={ws.members}
        selfId={selfId}
        onUpdate={updateWithUndo}
        onResolve={resolveWithUndo}
        onReopen={reopenWithUndo}
        onAssign={assignWithUndo}
        assignRequest={assignRequest}
        onDelete={deleteAndAdvance}
        onBack={deselect}
        resolveRequest={resolveRequest}
        reopenRequest={reopenRequest}
        onToast={toast}
        onRetryUploads={() => void retryUploads(selected.id)}
        onSend={(bug) => claude.sendBugs([bug])}
        onCopy={(bug) => claude.copyBugs([bug])}
        claudeRun={!selected.optimistic ? claude.runs.get(selected.number) : undefined}
      />
    )
  } else if (!hasNumberParam && loading) {
    // The list is still loading: the detail pane holds the shape of a bug, not a prompt to pick one.
    detail = <BugDetailSkeleton />
  } else if (!hasNumberParam && firstItem && desktop) {
    // Nothing filed yet: the onboarding is the screen's focal point here, not in the narrow list.
    detail = (
      <div className={DETAIL_COLUMN}>
        <Onboarding
          variant="pane"
          workspaceId={workspaceId}
          kind={filters.kind}
          tab={filters.tab}
          steps={onboardingSteps(bugs, ws.members.length, claude.connected)}
          onInvite={() => setInviteOpen(true)}
          onClaudeSetup={claude.openSetup}
        />
      </div>
    )
  } else if (!hasNumberParam && visible.length === 0) {
    // Nothing to pick (a filter matched nothing, an empty tab, a load error): the list says why.
    detail = null
  } else if (!hasNumberParam) {
    const one = filters.kind === 'feature' ? 'feature request' : 'bug'
    detail = (
      <StatePanel
        className={DETAIL_COLUMN}
        inset="deep"
        icon={MousePointerClick}
        title={`No ${one} open`}
        body={`Pick a ${one} from the list to read it, mark it up or send it to Claude Code.`}
        hints={
          <ul aria-label="Shortcuts">
            <li className={HINT_ROW}>
              <span className="flex gap-1">
                <Kbd>J</Kbd>
                <Kbd>K</Kbd>
              </span>
              Move through the list
            </li>
            <li className={HINT_ROW}>
              <Kbd>N</Kbd> File a new {one}
            </li>
            <li className={HINT_ROW}>
              <Kbd>?</Kbd> All shortcuts
            </li>
          </ul>
        }
      />
    )
  } else if (notFound) {
    detail = (
      <StatePanel
        className={DETAIL_COLUMN}
        inset="deep"
        icon={SearchX}
        title={`Bug #${numberParam} not found`}
        body="It may have been deleted, or the link is from another workspace."
        action={
          <Button variant="secondary" size="sm" onClick={deselect}>
            <ArrowLeft size={14} strokeWidth={1.5} aria-hidden="true" /> Back to list
          </Button>
        }
      />
    )
  } else {
    detail = <BugDetailSkeleton />
  }

  return (
    <div className="paper-grain flex h-dvh flex-col text-ink">
      <a
        href="#main"
        onClick={() => document.getElementById('main')?.focus()}
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-md focus:bg-bg focus:px-4 focus:py-2 focus:text-accent focus:outline focus:outline-2 focus:outline-accent"
      >
        Skip to content
      </a>
      <Header
        workspace={workspace}
        workspaces={workspaces}
        members={ws.members}
        online={presence.online}
        selfId={selfId}
        onInvite={() => setInviteOpen(true)}
        onShowShortcuts={() => setShortcutsOpen(true)}
        role={ws.role}
      />
      <ConnectionStatus />
      <main
        id="main"
        tabIndex={-1}
        className="flex min-h-0 flex-1 flex-col"
        style={{ '--list-w': `${listWidth}px` } as CSSProperties}
      >
        <h1 className="sr-only">{workspace.name}</h1>
        <section
          aria-label="File a bug"
          className={cn(
            'relative z-20 shrink-0 border-b border-line px-3 py-2.5 sm:px-4',
            showDetail && 'hidden lg:block',
          )}
        >
          {/* Spans the list and the detail column (DESIGN.md "App shell"); the bar styles itself.
              From 1440px, where the detail column is centred in a wide pane, the bar ends at the
              column's text edge, (pane width + list + 760px column + 1px rule) / 2, instead of
              running the full window width over empty paper. */}
          <div className="min-[1440px]:max-w-[calc((100%+var(--list-w)+761px)/2)]">
            <CaptureBar
              workspaceId={workspaceId}
              onSubmit={fileAndSelect}
              kind={filters.kind}
              onToast={toast}
              focusRef={captureRef}
            />
          </div>
        </section>
        <div className="min-h-0 flex-1 lg:grid lg:grid-cols-[var(--list-w)_1px_minmax(0,1fr)]">
          <div id="bug-list-pane" className={cn('h-full min-h-0 lg:block', showDetail && 'hidden')}>
            <BugList
              bugs={sorted}
              workspaceName={ws.workspace?.name}
              loading={loading}
              error={error}
              onRetry={reload}
              counts={counts}
              openByKind={openByKind}
              filters={filters}
              onFilters={applyFilters}
              selectedId={selected?.id ?? null}
              onSelect={select}
              members={ws.members}
              selfId={selfId}
              viewersOf={presence.viewers}
              highlightIds={highlightIds}
              searchRef={searchRef}
              pickedIds={effectivePickedIds}
              onTogglePick={togglePick}
              onClearPicked={clearPicked}
              onResolve={resolveBug}
              onReopen={reopenBug}
              onAssign={assign}
              onToggleStatus={toggleStatus}
              onSend={claude.sendBugs}
              onCopy={claude.copyBugs}
              onInvite={() => setInviteOpen(true)}
              onClaudeSetup={claude.openSetup}
              claudeConnected={claude.connected}
              claudeRuns={claude.runs}
              onboardingInDetail={desktop && !showDetail}
            />
          </div>
          <PaneSplitter
            width={listWidth}
            onWidth={setListWidth}
            onReset={resetListWidth}
            controls="bug-list-pane"
            className="hidden lg:block"
          />
          <div
            className={cn(
              'h-full min-h-0 min-w-0 overflow-x-hidden overflow-y-auto [scrollbar-gutter:stable] lg:block',
              !showDetail && 'hidden',
            )}
          >
            {detail}
          </div>
        </div>
      </main>
      <InviteDialog
        workspace={workspace}
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        canRegenerate={ws.role === 'owner'}
        onRegenerate={ws.regenerateInviteCode}
      />
      <ShortcutsSheet open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        commands={commands}
      />
      <ClaudeSetupDialog
        open={claude.setupOpen}
        onClose={claude.closeSetup}
        status={claude.status}
        workspaceId={workspaceId}
        workspaceName={workspace.name}
        pending={claude.pending}
        onSendPending={() => claude.sendBugs(claude.pending)}
      />
    </div>
  )
}
