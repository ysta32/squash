import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Check, Copy, FolderOpen, X } from 'lucide-react'
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
import { Button, Input, Kbd, proseLinkClass } from './ui'
import {
  closeButtonClass,
  dialogClass,
  dialogTitleClass,
  eyebrowClass,
  scrimClass,
} from './dialogStyles'

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
    <li className="grid grid-cols-[2rem_minmax(0,1fr)] gap-x-2 border-t border-line pt-4">
      <span
        className={cn(
          'flex h-6 items-center font-mono text-xs font-medium nums',
          done ? 'text-success' : 'text-ink-3',
        )}
      >
        {done ? (
          <Check size={16} absoluteStrokeWidth strokeWidth={1.5} aria-label="Done" />
        ) : (
          String(n).padStart(2, '0')
        )}
      </span>
      <div className="min-w-0 text-sm">{children}</div>
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
      className={cn(scrimClass, 'flex items-center justify-center p-3 sm:p-6')}
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Connect Claude Code"
        className={cn(dialogClass, 'max-h-[calc(100dvh-1.5rem)] max-w-140 overflow-y-auto')}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className={eyebrowClass}>Claude Code · setup</p>
              <h2 className={cn(dialogTitleClass, 'mt-1')}>Send bugs to Claude Code</h2>
              <p className="mt-2 text-sm text-ink-2">
                One press runs Claude Code in your project on the bug and its screenshots. When it
                is done, the terminal closes and the bug is resolved with Claude’s summary.
              </p>
            </div>
            <button type="button" aria-label="Close" onClick={onClose} className={closeButtonClass}>
              <X size={16} absoluteStrokeWidth strokeWidth={1.5} aria-hidden="true" />
            </button>
          </div>

          <p role="status" className="mt-5 flex items-start gap-3 text-sm text-ink-2">
            <span
              className={cn(
                eyebrowClass,
                'flex h-5 shrink-0 items-center gap-1.5',
                connected ? 'text-success' : outdated ? 'text-warning' : 'text-ink-2',
              )}
            >
              <span
                aria-hidden="true"
                className={cn(
                  'size-1.5 rounded-full',
                  connected ? 'bg-success' : outdated ? 'bg-warning' : 'bg-ink-3',
                )}
              />
              {connected ? 'Connected' : outdated ? 'Update needed' : 'Waiting'}
            </span>
            <span>
              {connected
                ? status.version >= AUTO_RESOLVE_VERSION
                  ? 'Connected to this computer'
                  : 'Connected. Run the command below again so Claude can follow along and resolve bugs on its own.'
                : outdated
                  ? 'An older helper is running. Run the command below to update it.'
                  : 'Waiting for the helper… this updates by itself'}
            </span>
          </p>

          <ol className="mt-5 space-y-4">
            <Step n={1} done={connected}>
              <p className="font-medium text-ink">
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
                <Button
                  data-autofocus
                  type="button"
                  onClick={() => void copy()}
                  variant={pending.length > 0 ? 'secondary' : 'primary'}
                  className="min-w-24"
                >
                  {copied ? (
                    <Check size={16} absoluteStrokeWidth strokeWidth={1.5} aria-hidden="true" />
                  ) : (
                    <Copy size={16} absoluteStrokeWidth strokeWidth={1.5} aria-hidden="true" />
                  )}
                  <span aria-live="polite">{copied ? 'Copied' : 'Copy'}</span>
                </Button>
              </div>
              <p className="mt-2 text-xs text-ink-2">
                {isMac ? (
                  <>
                    Open Terminal with <Kbd>⌘ Space</Kbd>, type “Terminal”, then press <Kbd>↵</Kbd>.
                    The helper starts automatically when you log in.{' '}
                  </>
                ) : (
                  'Keep that terminal open while you use Squash. '
                )}
                Needs{' '}
                <a
                  href="https://nodejs.org"
                  target="_blank"
                  rel="noreferrer"
                  className={proseLinkClass}
                >
                  Node.js
                </a>{' '}
                and{' '}
                <a
                  href="https://claude.com/claude-code"
                  target="_blank"
                  rel="noreferrer"
                  className={proseLinkClass}
                >
                  Claude Code
                </a>
                .
              </p>
            </Step>

            <Step n={2} done={connected && current !== null}>
              <p className="font-medium text-ink">Project folder for “{workspaceName}”</p>
              {!connected ? (
                <p className="mt-1 text-xs text-ink-2">Available once the helper is connected.</p>
              ) : (
                <>
                  <p className="mt-1 font-mono text-xs break-all text-ink-2">
                    {current ??
                      (nativePicker
                        ? 'Not chosen yet. You will be asked the first time you send.'
                        : 'Not set yet.')}
                  </p>
                  <p className="mt-1 text-xs text-ink-2">
                    Each workspace opens Claude in its own folder, in its own terminal window.
                  </p>
                  {nativePicker ? (
                    <Button
                      type="button"
                      disabled={busy}
                      onClick={() => void chooseFolder()}
                      className="mt-3"
                      size="sm"
                    >
                      <FolderOpen
                        size={14}
                        absoluteStrokeWidth
                        strokeWidth={1.5}
                        aria-hidden="true"
                      />
                      {busy
                        ? 'Choose in the dialog…'
                        : current
                          ? 'Change folder…'
                          : 'Choose folder…'}
                    </Button>
                  ) : (
                    <form
                      className="mt-3 flex gap-2"
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
            <div className="mt-6 flex justify-end">
              <Button
                type="button"
                disabled={!connected || (!nativePicker && current === null)}
                onClick={onSendPending}
                variant="primary"
              >
                Send {count} to Claude Code
              </Button>
            </div>
          )}
        </div>

        <p className="border-t border-line bg-surface-1 px-6 py-4 text-xs leading-relaxed text-ink-2">
          The helper listens at <code className="font-mono text-ink">127.0.0.1:4317</code> and
          accepts requests from configured Squash origins. It saves the bugs and screenshots you
          send in your project and starts Claude Code there with your Claude Code permissions. To
          remove it, run the same command with{' '}
          <code className="font-mono text-ink">--uninstall</code> in place of the address at the
          end.{' '}
          <a href="/claude" target="_blank" rel="noreferrer" className={proseLinkClass}>
            Full setup guide
          </a>
        </p>
      </div>
    </div>
  )
}
