import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { BugDetail } from '../components/BugDetail'
import { BugList } from '../components/BugList'
import { CaptureBar } from '../components/CaptureBar'
import { Header } from '../components/Header'
import { InviteDialog } from '../components/InviteDialog'
import { ReconnectingPill } from '../components/ReconnectingPill'
import { ShortcutsSheet } from '../components/ShortcutsSheet'
import { useToast } from '../components/Toast'
import { filterBugs, useBugs, type BugFilters } from '../hooks/useBugs'
import { useOverlayOpen, useShortcut } from '../hooks/useKeyboard'
import { usePresence } from '../hooks/usePresence'
import { setLastWorkspace, useWorkspace, useWorkspaces } from '../hooks/useWorkspaces'
import { useAuth } from '../lib/auth'
import type { Bug } from '../lib/types'
import { cn } from '../lib/utils'

const DEFAULT_FILTERS: BugFilters = {
  tab: 'open',
  filedBy: null,
  resolvedBy: null,
  severity: null,
  query: '',
}
const HIGHLIGHT_MS = 3000

function isDesktop(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia('(min-width: 768px)').matches
}

export default function Workspace() {
  const { workspaceId = '', number: numberParam } = useParams<{
    workspaceId: string
    number?: string
  }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const selfId = user?.id ?? ''
  const { toast } = useToast()
  const ws = useWorkspace(workspaceId)
  const { workspaces } = useWorkspaces()

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
      toast(`${name} filed #${bug.number}`)
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

  const { bugs, loading, counts, fileBug, updateBug, resolveBug, reopenBug, getBugByNumber } =
    useBugs(workspaceId, { onRemoteInsert })

  const [filters, setFilters] = useState<BugFilters>(DEFAULT_FILTERS)
  /** Selection of an optimistic bug (no number yet, so it cannot live in the URL). */
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [lookupMissing, setLookupMissing] = useState<number | null>(null)
  const [resolveRequest, setResolveRequest] = useState(0)
  const [reopenRequest, setReopenRequest] = useState(0)
  const [inviteOpen, setInviteOpen] = useState(false)
  const [shortcutsOpen, setShortcutsOpen] = useState(false)
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
  const bugPath = useCallback((n: number) => `/app/${workspaceId}/bug/${n}`, [workspaceId])

  const presence = usePresence(workspaceId, selected?.id ?? null)

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
        if (hasNumberParam) navigate(basePath, { replace: opts?.replace })
        return
      }
      setPendingId(null)
      navigate(bugPath(bug.number), { replace: opts?.replace })
    },
    [bugs, hasNumberParam, navigate, basePath, bugPath],
  )

  const deselect = useCallback(() => {
    setPendingId(null)
    if (hasNumberParam) navigate(basePath)
  }, [hasNumberParam, navigate, basePath])

  const visible = useMemo(() => filterBugs(bugs, filters), [bugs, filters])

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
  const shortcutsEnabled = !inviteOpen && !shortcutsOpen && ws.workspace !== null
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

  if (ws.notFound) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-3 bg-bg p-6 text-fg">
        <p className="text-sm">You&apos;re not a member of this workspace</p>
        <Link to="/app" className="text-sm text-accent underline-offset-4 hover:underline">
          Go to your workspaces
        </Link>
      </main>
    )
  }

  if (!ws.workspace) {
    return (
      <div role="status" aria-label="Loading workspace" className="min-h-screen bg-bg">
        <span className="sr-only">Loading…</span>
        <div className="h-12 border-b border-border" />
        <div className="mx-auto mt-4 max-w-3xl space-y-3 px-4">
          <div className="h-20 animate-pulse rounded-lg bg-bg-subtle" />
          <div className="h-10 animate-pulse rounded-lg bg-bg-subtle" />
        </div>
      </div>
    )
  }

  const workspace = ws.workspace

  let detail: ReactNode
  if (selected || !hasNumberParam) {
    detail = (
      <BugDetail
        bug={selected}
        members={ws.members}
        selfId={selfId}
        onUpdate={updateBug}
        onResolve={resolveBug}
        onReopen={reopenBug}
        onBack={deselect}
        resolveRequest={resolveRequest}
        reopenRequest={reopenRequest}
        onToast={toast}
      />
    )
  } else if (notFound) {
    detail = (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-sm text-muted">
        <p>Bug #{numberParam} not found</p>
        <button
          type="button"
          onClick={deselect}
          className="inline-flex items-center gap-1.5 text-accent hover:underline"
        >
          <ArrowLeft size={14} aria-hidden="true" /> Back to list
        </button>
      </div>
    )
  } else {
    detail = (
      <div role="status" aria-label="Loading bug" className="space-y-3 p-6">
        <div className="h-6 w-2/3 animate-pulse rounded bg-bg-subtle" />
        <div className="h-24 animate-pulse rounded bg-bg-subtle" />
      </div>
    )
  }

  return (
    <div className="flex h-dvh flex-col bg-bg text-fg">
      <Header
        workspace={workspace}
        workspaces={workspaces}
        members={ws.members}
        online={presence.online}
        selfId={selfId}
        onInvite={() => setInviteOpen(true)}
        role={ws.role}
      />
      <div
        className={cn(
          'sticky top-0 z-10 border-b border-border bg-bg p-3',
          showDetail && 'hidden md:block',
        )}
      >
        <div className="mx-auto max-w-5xl">
          <CaptureBar
            workspaceId={workspaceId}
            onSubmit={fileBug}
            onToast={toast}
            focusRef={captureRef}
          />
        </div>
      </div>
      <div className="min-h-0 flex-1 md:grid md:grid-cols-[minmax(320px,2fr)_3fr]">
        <div
          className={cn(
            'h-full min-h-0 md:block md:border-r md:border-border',
            showDetail && 'hidden',
          )}
        >
          <BugList
            bugs={bugs}
            loading={loading}
            counts={counts}
            filters={filters}
            onFilters={setFilters}
            selectedId={selected?.id ?? null}
            onSelect={select}
            members={ws.members}
            viewersOf={presence.viewers}
            highlightIds={highlightIds}
            searchRef={searchRef}
          />
        </div>
        <div className={cn('h-full min-h-0 overflow-y-auto md:block', !showDetail && 'hidden')}>
          {detail}
        </div>
      </div>
      <InviteDialog
        workspace={workspace}
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        canRegenerate={ws.role === 'owner'}
        onRegenerate={ws.regenerateInviteCode}
      />
      <ShortcutsSheet open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
      <ReconnectingPill />
    </div>
  )
}
