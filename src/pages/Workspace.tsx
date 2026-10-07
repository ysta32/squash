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
import { countBugs, filterBugs, useBugs, type BugFilters } from '../hooks/useBugs'
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
import { NEXT_THEME, useTheme } from '../lib/theme'
import type { Bug, BugKind } from '../lib/types'
import { cn, isMac } from '../lib/utils'

const DEFAULT_FILTERS: BugFilters = {
  kind: 'bug',
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
        onClick: () => navigate(`/app/${workspaceId}/bug/${bug.number}`),
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
    fileBug,
    updateBug,
    resolveBug,
    reopenBug,
    deleteBug,
    retryUploads,
    getBugByNumber,
  } = useBugs(workspaceId, { onRemoteInsert })

  const [filters, setFilters] = useState<BugFilters>(DEFAULT_FILTERS)
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
  const [inviteOpen, setInviteOpen] = useState(false)
  const [shortcutsOpen, setShortcutsOpen] = useState(false)
  const [paletteOpen, setPaletteOpen] = useState(false)
  const { theme, setTheme } = useTheme()
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

  // The list follows the open item's kind: a deep link to a feature request (or moving the open
  // item between Bugs and Features) switches the list to match.
  const selectedKind = selected?.kind ?? null
  const [followedKind, setFollowedKind] = useState<BugKind | null>(null)
  if (selectedKind !== followedKind) {
    setFollowedKind(selectedKind)
    if (selectedKind !== null && selectedKind !== filters.kind) {
      setFilters((f) => ({ ...f, kind: selectedKind }))
      setPickedIds(new Set())
    }
  }

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
            if (hasNumberParam) navigate(basePath)
          },
        })
      } catch (err) {
        if (newId !== null) setPendingId((p) => (p === newId ? null : p))
        throw err
      }
    },
    [fileBug, hasNumberParam, navigate, basePath],
  )

  const deselect = useCallback(() => {
    setPendingId(null)
    if (hasNumberParam) navigate(basePath)
  }, [hasNumberParam, navigate, basePath])

  const deleteAndDeselect = useCallback(
    async (id: string) => {
      const bug = bugs.find((b) => b.id === id)
      await deleteBug(id)
      setPickedIds((prev) => {
        if (!prev.has(id)) return prev
        const next = new Set(prev)
        next.delete(id)
        return next
      })
      if (bug) toast(`Deleted ${bug.kind === 'feature' ? 'feature ' : ''}#${bug.number}`)
      deselect()
    },
    [bugs, deleteBug, toast, deselect],
  )

  const visible = useMemo(() => filterBugs(bugs, filters), [bugs, filters])
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
      const picked = bugs.filter((b) => pickedIds.has(b.id))
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

  const commands: Command[] = [
    {
      id: 'new',
      label: filters.kind === 'feature' ? 'New feature request' : 'New bug',
      group: 'Actions',
      hint: 'N',
      keywords: ['file', 'capture', 'report'],
      run: () => focusInList(captureRef),
    },
    {
      id: 'search',
      label: 'Search',
      group: 'Actions',
      hint: '/',
      keywords: ['find', 'filter'],
      run: () => focusInList(searchRef),
    },
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
      run: () => setShortcutsOpen(true),
    },
  ]

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
        onDelete={deleteAndDeselect}
        onBack={deselect}
        resolveRequest={resolveRequest}
        reopenRequest={reopenRequest}
        onToast={toast}
        onRetryUploads={selected ? () => void retryUploads(selected.id) : undefined}
        onSend={(bug) => claude.sendBugs([bug])}
        onCopy={(bug) => claude.copyBugs([bug])}
        claudeRun={selected && !selected.optimistic ? claude.runs.get(selected.number) : undefined}
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
            onSubmit={fileAndSelect}
            kind={filters.kind}
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
            workspaceName={ws.workspace?.name}
            loading={loading}
            counts={counts}
            openByKind={openByKind}
            filters={filters}
            onFilters={(next) => {
              // Switching between Bugs and Features starts fresh: no picks, nothing open.
              if (next.kind !== filters.kind) {
                clearPicked()
                deselect()
              }
              setFilters(next)
            }}
            selectedId={selected?.id ?? null}
            onSelect={select}
            members={ws.members}
            viewersOf={presence.viewers}
            highlightIds={highlightIds}
            searchRef={searchRef}
            pickedIds={pickedIds}
            onTogglePick={togglePick}
            onClearPicked={clearPicked}
            onSend={claude.sendBugs}
            onCopy={claude.copyBugs}
            onClaudeSetup={claude.openSetup}
            claudeConnected={claude.connected}
            claudeRuns={claude.runs}
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
      <ReconnectingPill />
    </div>
  )
}
