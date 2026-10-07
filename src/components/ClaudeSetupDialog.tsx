import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Bot, Check, Copy, FolderOpen, X } from 'lucide-react'
import { useFocusTrap } from '../hooks/useFocusTrap'
import { useOverlayOpen } from '../hooks/useKeyboard'
import {
  BRIDGE_VERSION,
  AUTO_RESOLVE_VERSION,
  getBridgeFolder,
  installCommand,
  setBridgeFolder,
  type BridgeStatus,
} from '../lib/claudeExport'
import type { BugWithMeta } from '../lib/types'
import { cn, isMac } from '../lib/utils'
import {
  Badge,
  Button,
  Input,
  Kbd,
  dialogOverlayClass,
  dialogPanelClass,
  proseLinkClass,
} from './ui'

export interface ClaudeSetupDialogProps {
  open: boolean
  onClose: () => void
  status: BridgeStatus | null
  workspaceId: string
  workspaceName: string
  /** Bugs waiting to be sent once setup is done. */
  pending: BugWithMeta[]
  onSendPending: () => void
}

function Step({ n, done, children }: { n: number; done: boolean; children: ReactNode }) {
  return (
    <li className="flex gap-3">
      <span
        className={cn(
          'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-medium',
          done ? 'bg-success/15 text-success' : 'bg-bg-subtle text-muted',
        )}
      >
        {done ? <Check size={12} aria-hidden="true" /> : n}
      </span>
      <div className="min-w-0 flex-1 text-sm">{children}</div>
    </li>
  )
}

export function ClaudeSetupDialog({
  open,
  onClose,
  status,
  workspaceId,
  workspaceName,
  pending,
  onSendPending,
}: ClaudeSetupDialogProps) {
  useOverlayOpen(open)
  const dialogRef = useRef<HTMLDivElement>(null)
  useFocusTrap(dialogRef, open)
  const [copied, setCopied] = useState(false)
  const [folder, setFolder] = useState<{ ws: string; path: string | null } | null>(null)
  const [typed, setTyped] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const connected = status !== null && status.version >= BRIDGE_VERSION
  const outdated = status !== null && !connected
  const nativePicker = status?.platform === 'darwin'
  const command = installCommand(window.location.origin)
  const current = folder?.ws === workspaceId ? folder.path : null

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  useEffect(() => {
    if (!copied) return
    const t = setTimeout(() => setCopied(false), 2000)
    return () => clearTimeout(t)
  }, [copied])

  useEffect(() => {
    if (!open || !connected) return
    let active = true
    getBridgeFolder(workspaceId).then(
      (path) => active && setFolder({ ws: workspaceId, path }),
      () => {},
    )
    return () => {
      active = false
    }
  }, [open, connected, workspaceId])

  if (!open) return null

  const copy = async () => {
    setError(null)
    setCopied(false)
    try {
      await navigator.clipboard.writeText(command)
      setCopied(true)
    } catch {
      setError('Could not copy. Select the command and copy it manually.')
    }
  }

  const chooseFolder = async (path?: string) => {
    setBusy(true)
    setError(null)
    try {
      setFolder({ ws: workspaceId, path: await setBridgeFolder(workspaceId, workspaceName, path) })
      setTyped('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not set the folder.')
    } finally {
      setBusy(false)
    }
  }

  const count = pending.length === 1 ? `#${pending[0].number}` : `${pending.length} bugs`

  return (
    <div
      className={cn(dialogOverlayClass, 'flex items-center justify-center p-4')}
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Connect Claude Code"
        className={cn(
          dialogPanelClass,
          'max-h-[calc(100dvh-2rem)] max-w-lg overflow-y-auto p-5 text-fg',
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="flex items-center gap-2 text-base font-semibold">
              <Bot className="size-4 text-muted" aria-hidden="true" /> Send bugs to Claude Code
            </h2>
            <p className="mt-1 text-sm text-muted">
              One press runs Claude Code in your project on the bug and its screenshots. When it is
              done, the terminal closes and the bug is resolved with Claude’s summary.
            </p>
          </div>
          <Button
            type="button"
            aria-label="Close"
            onClick={onClose}
            variant="ghost"
            className="-mt-1 -mr-1 size-8 px-0"
          >
            <X className="size-4" aria-hidden="true" />
          </Button>
        </div>

        <p role="status" className="mt-4 flex items-start gap-2 text-sm leading-6 text-muted">
          <Badge
            tone={connected ? 'success' : outdated ? 'warning' : 'neutral'}
            className="shrink-0 text-xs"
          >
            {connected ? 'Connected' : outdated ? 'Update needed' : 'Waiting'}
          </Badge>
          {connected
            ? status.version >= AUTO_RESOLVE_VERSION
              ? 'Connected to this computer'
              : 'Connected. Run the command below again so Claude can follow along and resolve bugs on its own.'
            : outdated
              ? 'An older helper is running. Run the command below to update it.'
              : 'Waiting for the helper… this updates by itself'}
        </p>

        <ol className="mt-4 space-y-5">
          <Step n={1} done={connected}>
            <p className="font-medium">
              {outdated ? 'Update the helper' : 'Paste this into Terminal and press Enter'}
            </p>
            <div className="mt-2 flex gap-2">
              <Input
                readOnly
                value={command}
                aria-label="Install command"
                onFocus={(e) => e.currentTarget.select()}
                className="min-w-0 flex-1 font-mono text-xs"
              />
              <Button type="button" onClick={() => void copy()} variant="primary">
                {copied ? (
                  <Check size={14} aria-hidden="true" />
                ) : (
                  <Copy size={14} aria-hidden="true" />
                )}
                <span aria-live="polite">{copied ? 'Copied' : 'Copy'}</span>
              </Button>
            </div>
            <p className="mt-2 text-xs text-muted">
              {isMac ? (
                <>
                  Open Terminal with <Kbd>⌘ Space</Kbd>, type “Terminal”, then press{' '}
                  <Kbd>Enter</Kbd>. The helper starts automatically when you log in.{' '}
                </>
              ) : (
                'Keep that terminal open while you use Squash. '
              )}
              Needs{' '}
              <a
                href="https://nodejs.org"
                target="_blank"
                rel="noreferrer"
                className="focus-ring rounded-md underline underline-offset-2"
              >
                Node.js
              </a>{' '}
              and{' '}
              <a
                href="https://claude.com/claude-code"
                target="_blank"
                rel="noreferrer"
                className="focus-ring rounded-md underline underline-offset-2"
              >
                Claude Code
              </a>
              .
            </p>
          </Step>

          <Step n={2} done={connected && current !== null}>
            <p className="font-medium">Project folder for “{workspaceName}”</p>
            {!connected ? (
              <p className="mt-1 text-xs text-muted">Available once the helper is connected.</p>
            ) : (
              <>
                <p className="mt-1 break-all font-mono text-xs text-muted">
                  {current ??
                    (nativePicker
                      ? 'Not chosen yet. You will be asked the first time you send.'
                      : 'Not set yet.')}
                </p>
                <p className="mt-1 text-xs text-muted">
                  Each workspace opens Claude in its own folder, in its own terminal window.
                </p>
                {nativePicker ? (
                  <Button
                    type="button"
                    disabled={busy}
                    onClick={() => void chooseFolder()}
                    className="mt-2"
                    size="sm"
                  >
                    <FolderOpen size={14} aria-hidden="true" />
                    {busy ? 'Choose in the dialog…' : current ? 'Change folder…' : 'Choose folder…'}
                  </Button>
                ) : (
                  <form
                    className="mt-2 flex gap-2"
                    onSubmit={(e) => {
                      e.preventDefault()
                      if (typed.trim()) void chooseFolder(typed)
                    }}
                  >
                    <Input
                      value={typed}
                      onChange={(e) => setTyped(e.target.value)}
                      placeholder="~/code/my-app"
                      aria-label="Project folder path"
                      className="min-w-0 flex-1 font-mono text-xs"
                    />
                    <Button type="submit" disabled={busy || !typed.trim()} variant="secondary">
                      Save
                    </Button>
                  </form>
                )}
              </>
            )}
          </Step>
        </ol>

        {error && (
          <p role="alert" className="mt-4 text-sm text-danger">
            {error}
          </p>
        )}

        {pending.length > 0 && (
          <Button
            type="button"
            disabled={!connected || (!nativePicker && current === null)}
            onClick={onSendPending}
            variant="primary"
            className="mt-6 w-full"
          >
            <Bot size={16} aria-hidden="true" /> Send {count} to Claude
          </Button>
        )}

        <p className="-mx-5 mt-5 -mb-5 border-t border-border bg-bg-subtle/60 px-5 py-3 text-xs leading-relaxed text-muted">
          The helper listens at <code className="font-mono">127.0.0.1:4317</code> and accepts
          requests from configured Squash origins. It saves the bugs and screenshots you send in
          your project and starts Claude Code there with your Claude Code permissions. To remove it,
          run the same command with <code className="font-mono">--uninstall</code> in place of the
          address at the end.{' '}
          <a href="/claude" target="_blank" rel="noreferrer" className={proseLinkClass}>
            Full setup guide
          </a>
        </p>
      </div>
    </div>
  )
}
