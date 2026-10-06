import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  BRIDGE_VERSION,
  BridgeError,
  PROGRESS_VERSION,
  buildClaudeExport,
  copyPending,
  getBridgeRuns,
  isRunActive,
  latestRunByBug,
  pingBridge,
  sendToBridge,
  type BridgeStatus,
  type ClaudeRun,
} from '../lib/claudeExport'
import type { BugWithMeta, WorkspaceMember } from '../lib/types'

const POLL_MS = 1500
/** How often to check on Claude while a run is in progress, and otherwise. */
const RUN_POLL_ACTIVE_MS = 2000
const RUN_POLL_IDLE_MS = 15_000

export interface UseClaudeExportResult {
  /** Running bridge, or null when it is not reachable. */
  status: BridgeStatus | null
  /** True when a bridge new enough to route by workspace is running. */
  connected: boolean
  /** Opens Claude Code on the bugs via the bridge; opens the setup guide when it is not connected. */
  sendBugs(bugs: BugWithMeta[]): void
  /** Copies a ready-to-paste prompt for Claude Code. */
  copyBugs(bugs: BugWithMeta[]): void
  setupOpen: boolean
  openSetup(): void
  closeSetup(): void
  /** Bugs the user tried to send before the bridge was connected. */
  pending: BugWithMeta[]
  /** Latest Claude run per bug number, when the bridge reports progress. */
  runs: Map<number, ClaudeRun>
}

function label(bugs: BugWithMeta[]): string {
  return bugs.length === 1 ? `#${bugs[0].number}` : `${bugs.length} bugs`
}

export function useClaudeExport(
  workspaceId: string,
  workspaceName: string,
  members: WorkspaceMember[],
  onToast: (msg: string) => void,
): UseClaudeExportResult {
  const [status, setStatus] = useState<BridgeStatus | null>(null)
  const [setupOpen, setSetupOpen] = useState(false)
  const [pending, setPending] = useState<BugWithMeta[]>([])
  const connected = status !== null && status.version >= BRIDGE_VERSION
  const tracksProgress = status !== null && status.version >= PROGRESS_VERSION
  const [runList, setRunList] = useState<ClaudeRun[]>([])
  /** Bumped after a send so progress polling starts right away. */
  const [runsNonce, setRunsNonce] = useState(0)
  const anyActive = tracksProgress && runList.some(isRunActive)

  // Check on load and whenever the tab regains focus; poll while the setup guide is open so it
  // flips to "Connected" as soon as the install command finishes.
  useEffect(() => {
    let active = true
    const check = () => void pingBridge().then((s) => active && setStatus(s))
    check()
    window.addEventListener('focus', check)
    const timer = setupOpen ? setInterval(check, POLL_MS) : undefined
    return () => {
      active = false
      window.removeEventListener('focus', check)
      if (timer !== undefined) clearInterval(timer)
    }
  }, [setupOpen])

  // Follow Claude's runs: fast while one is in progress, slowly otherwise (a run can also be
  // started from another tab). Stops when the bridge is gone or too old to report progress.
  useEffect(() => {
    if (!tracksProgress) return
    let active = true
    const load = () =>
      void getBridgeRuns(workspaceId).then(
        (runs) => active && setRunList(runs),
        () => {},
      )
    load()
    const timer = setInterval(load, anyActive ? RUN_POLL_ACTIVE_MS : RUN_POLL_IDLE_MS)
    window.addEventListener('focus', load)
    return () => {
      active = false
      clearInterval(timer)
      window.removeEventListener('focus', load)
    }
  }, [tracksProgress, workspaceId, anyActive, runsNonce])

  // Runs from a bridge that has since stopped are stale: show none until it is back.
  const runs = useMemo(
    () => latestRunByBug(tracksProgress ? runList : []),
    [tracksProgress, runList],
  )

  const sendBugs = useCallback(
    (all: BugWithMeta[]) => {
      const bugs = all.filter((b) => !b.optimistic)
      if (bugs.length === 0) return
      if (!connected) {
        setPending(bugs)
        setSetupOpen(true)
        return
      }
      onToast(`Sending ${label(bugs)} to Claude Code…`)
      const input = { bugs, members, workspaceId, workspaceName, origin: window.location.origin }
      sendToBridge(input).then(
        () => {
          setPending([])
          setSetupOpen(false)
          setRunsNonce((n) => n + 1)
          onToast(
            tracksProgress
              ? `Claude Code is fixing ${label(bugs)}. Follow along on the bug.`
              : `Claude Code is fixing ${label(bugs)}. Reinstall the helper (Claude setup) to follow its progress here.`,
          )
        },
        (err: unknown) => {
          if (err instanceof BridgeError && err.code === 'cancelled') {
            onToast('No project folder chosen, so nothing was sent.')
            return
          }
          // fetch rejects with a TypeError when the bridge is unreachable.
          const unreachable = err instanceof TypeError
          if (unreachable || (err instanceof BridgeError && err.code === 'no_folder')) {
            // The setup guide fixes both, then offers to send these bugs again.
            if (unreachable) setStatus(null)
            setPending(bugs)
            setSetupOpen(true)
          }
          onToast(
            unreachable
              ? 'The Claude Code helper stopped responding.'
              : err instanceof Error
                ? err.message
                : 'Could not send to Claude.',
          )
        },
      )
    },
    [connected, tracksProgress, members, workspaceId, workspaceName, onToast],
  )

  const copyBugs = useCallback(
    (all: BugWithMeta[]) => {
      const bugs = all.filter((b) => !b.optimistic)
      if (bugs.length === 0) return
      const input = { bugs, members, workspaceName, origin: window.location.origin }
      copyPending(buildClaudeExport(input).then((e) => e.prompt)).then(
        () => onToast(`Copied ${label(bugs)}. Paste into Claude Code.`),
        (err: unknown) => onToast(err instanceof Error ? err.message : 'Could not copy.'),
      )
    },
    [members, workspaceName, onToast],
  )

  const openSetup = useCallback(() => setSetupOpen(true), [])
  const closeSetup = useCallback(() => {
    setSetupOpen(false)
    setPending([])
  }, [])

  return {
    status,
    connected,
    sendBugs,
    copyBugs,
    setupOpen,
    openSetup,
    closeSetup,
    pending,
    runs,
  }
}
