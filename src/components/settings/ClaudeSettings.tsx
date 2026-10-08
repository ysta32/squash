import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Button, proseLinkClass } from '../ui'
import { ClaudeSetupDialog } from '../ClaudeSetupDialog'
import {
  BRIDGE_VERSION,
  HARDENED_VERSION,
  getAutoSend,
  getBridgeFolder,
  pingBridge,
  setAutoSend,
  type BridgeStatus,
} from '../../lib/claudeExport'
import { cn } from '../../lib/utils'
import { LedgerGroup, LedgerRow, SettingsPanel, TOUCH } from './Ledger'

type Check =
  | { state: 'checking' }
  | { state: 'done'; status: BridgeStatus | null; folder: string | null; folderError: boolean }

const PLATFORM: Record<string, string> = { darwin: 'macOS', linux: 'Linux', win32: 'Windows' }

/** Poll interval while the setup guide is open (same as useClaudeExport). */
export const SETUP_POLL_MS = 1500

/** Claude Code connection for this workspace: helper status, project folder and setup. */
export function ClaudeSettings({
  workspaceId,
  workspaceName,
}: {
  workspaceId: string
  workspaceName: string
}) {
  const [check, setCheck] = useState<Check>({ state: 'checking' })
  const [setupOpen, setSetupOpen] = useState(false)
  const [autoSend, setAutoSendState] = useState(() => getAutoSend(workspaceId))
  const toggleAutoSend = () => {
    setAutoSend(workspaceId, !autoSend)
    setAutoSendState(!autoSend)
  }

  // Pure probe: no state writes, so the mount effect only sets state from its callback.
  const probe = useCallback(async (): Promise<Check> => {
    const status = await pingBridge()
    let folder: string | null = null
    let folderError = false
    if (status && status.version >= BRIDGE_VERSION) {
      try {
        folder = await getBridgeFolder(workspaceId)
      } catch {
        folderError = true
      }
    }
    return { state: 'done' as const, status, folder, folderError }
  }, [workspaceId])

  // Each probe gets a number; only the newest one may write, so a slow early answer never
  // overwrites a fresher one.
  const latest = useRef(0)
  const apply = useCallback(
    (id: number, result: Check) => {
      if (id === latest.current) setCheck(result)
    },
    [setCheck],
  )

  // Check on mount and whenever the window regains focus (the helper may have been installed in a
  // terminal meanwhile); poll while the setup guide is open so it flips to "Connected" as soon as
  // the install command finishes. Background checks keep the current status on screen.
  useEffect(() => {
    let active = true
    let busy = false
    const quiet = () => {
      if (busy) return
      busy = true
      const id = ++latest.current
      void probe().then((result) => {
        busy = false
        if (active) apply(id, result)
      })
    }
    quiet()
    window.addEventListener('focus', quiet)
    const timer = setupOpen ? window.setInterval(quiet, SETUP_POLL_MS) : undefined
    return () => {
      active = false
      window.removeEventListener('focus', quiet)
      if (timer !== undefined) window.clearInterval(timer)
    }
  }, [probe, apply, setupOpen])

  const recheck = () => {
    const id = ++latest.current
    setCheck({ state: 'checking' })
    void probe().then((result) => apply(id, result))
  }
  const checking = check.state === 'checking'
  const status = check.state === 'done' ? check.status : null
  const connected = status !== null && status.version >= BRIDGE_VERSION
  const outdated = status !== null && (!connected || status.version < HARDENED_VERSION)

  const helperText = checking
    ? 'Checking this computer…'
    : !status
      ? 'Not running on this computer.'
      : `${outdated ? 'Running, update available' : 'Connected'} · helper v${status.version}${
          PLATFORM[status.platform] ? ` · ${PLATFORM[status.platform]}` : ''
        }`

  return (
    <SettingsPanel
      id="claude"
      title="Claude Code"
      description="Send bugs to Claude Code on your computer. A small local helper opens it in this workspace’s project folder with the bug and its screenshots."
    >
      <LedgerGroup>
        <LedgerRow
          label="Local helper"
          description={
            <span role="status" className="inline-flex items-center gap-2">
              <span
                aria-hidden="true"
                className={cn(
                  'size-1.5 shrink-0 rounded-full',
                  checking ? 'bg-ink-3' : connected && !outdated ? 'bg-success' : 'bg-warning',
                )}
              />
              {helperText}
            </span>
          }
        >
          {/* Primary first, so a wrapped row starts on a filled button, flush with the text. */}
          <Button
            variant={connected && !outdated ? 'secondary' : 'primary'}
            className={TOUCH}
            disabled={checking}
            onClick={() => setSetupOpen(true)}
          >
            {!status ? 'Set up' : outdated ? 'Update' : 'Reinstall'}
          </Button>
          <Button variant="ghost" disabled={checking} className={TOUCH} onClick={recheck}>
            Check again
          </Button>
        </LedgerRow>
        <LedgerRow
          label="Project folder"
          description={
            checking ? (
              'Checking…'
            ) : !connected ? (
              'Available once the helper is running.'
            ) : check.state === 'done' && check.folderError ? (
              <span className="text-danger">Could not read the folder from the helper.</span>
            ) : check.state === 'done' && check.folder ? (
              <code className="font-mono text-sm break-all text-ink">{check.folder}</code>
            ) : (
              'Not set. Claude Code asks for it the first time you send a bug.'
            )
          }
        >
          {connected && (
            <Button className={TOUCH} onClick={() => setSetupOpen(true)}>
              {check.state === 'done' && check.folder ? 'Change' : 'Choose'}
            </Button>
          )}
        </LedgerRow>
        <LedgerRow
          label="Auto-fix new items"
          labelId="claude-auto-send-label"
          description="Send each bug or feature request you file here straight to Claude Code. It implements it, commits, pushes and closes its terminal when done. Applies to this browser only."
        >
          <Button
            variant={autoSend ? 'primary' : 'secondary'}
            className={TOUCH}
            aria-pressed={autoSend}
            aria-labelledby="claude-auto-send-label"
            onClick={toggleAutoSend}
          >
            {autoSend ? 'On' : 'Off'}
          </Button>
        </LedgerRow>
        <LedgerRow
          label="Guide"
          description={
            <>
              How sending, progress and auto-resolve work, step by step.{' '}
              <Link to="/claude" className={proseLinkClass}>
                Read the Claude Code guide
              </Link>
            </>
          }
        />
      </LedgerGroup>
      <ClaudeSetupDialog
        open={setupOpen}
        onClose={() => {
          setSetupOpen(false)
          recheck()
        }}
        status={status}
        workspaceId={workspaceId}
        workspaceName={workspaceName}
        pending={[]}
        onSendPending={() => setSetupOpen(false)}
      />
    </SettingsPanel>
  )
}
