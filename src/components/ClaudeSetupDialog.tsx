import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { Check, ChevronRight, Copy, FolderOpen } from 'lucide-react'
import { useFocusTrap } from '../hooks/useFocusTrap'
import { useOverlayOpen } from '../hooks/useKeyboard'
import { useCoarsePointer } from '../hooks/useCoarsePointer'
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
import { Button, ENTER_KEY, Input, Kbd, Keys, proseLinkClass } from './ui'
import { DialogHeader } from './DialogHeader'
import { dialogClass, dialogMaxHeightClass, dialogPositionClass, scrimClass } from './dialogStyles'

/**
 * Horizontal fades on the command scroller: the ends soften instead of slicing a glyph in half.
 * The scroller's own padding (pl-3, pr-6) sits under the fades, so at either scroll end the
 * first and last characters are fully opaque.
 */
const EDGE_FADE =
  '[mask-image:linear-gradient(to_right,transparent,black_0.75rem,black_calc(100%-1.5rem),transparent)] [-webkit-mask-image:linear-gradient(to_right,transparent,black_0.75rem,black_calc(100%-1.5rem),transparent)]'

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
          // One text-sm line tall, so the number or tick centres on the step's first line.
          'flex h-[1.4286rem] items-center font-mono text-xs font-medium nums',
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
  useFocusTrap(dialogRef, open, { initialFocus: 'field' })
  const installId = useId()
  const touch = useCoarsePointer()
  const [copied, setCopied] = useState(false)
  const [showInstall, setShowInstall] = useState(false)
  const [folder, setFolder] = useState<{ ws: string; path: string | null } | null>(null)
  const [typed, setTyped] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const connected = status !== null && status.version >= BRIDGE_VERSION
  const outdated = status !== null && !connected
  const nativePicker = status?.platform === 'darwin'
  const command = installCommand(window.location.origin)
  const current = folder?.ws === workspaceId ? folder.path : null
  // Once a current helper is connected the install step is done: fold it to one line.
  const installDone = connected && status.version >= AUTO_RESOLVE_VERSION
  const installOpen = !installDone || showInstall

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
    <div className={cn(scrimClass, dialogPositionClass)} onClick={onClose}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Connect Claude Code"
        className={cn(dialogClass, dialogMaxHeightClass, 'max-w-140 overflow-y-auto')}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6">
          <DialogHeader
            eyebrow="Claude Code · setup"
            title="Send bugs to Claude Code"
            onClose={onClose}
          >
            <p className="mt-2 text-sm text-ink-2">
              One press runs Claude Code in your project on the bug and its screenshots. When it is
              done, the terminal closes and the bug is resolved with Claude’s summary.
            </p>
          </DialogHeader>

          <p role="status" className="mt-5 flex items-start gap-2.5 text-sm text-ink">
            <span aria-hidden="true" className="flex h-5 shrink-0 items-center">
              <span
                className={cn(
                  'size-2 rounded-full',
                  connected ? 'bg-success' : outdated ? 'bg-warning' : 'bg-ink-3',
                )}
              />
            </span>
            <span>
              {connected
                ? installDone
                  ? 'Connected to this computer.'
                  : 'Connected. Run the command below again so Claude can follow along and resolve bugs on its own.'
                : outdated
                  ? 'An older helper is running. Run the command below to update it.'
                  : 'Waiting for the helper… this updates by itself.'}
            </span>
          </p>

          <ol className="mt-5 space-y-4">
            <Step n={1} done={connected}>
              {installDone && (
                <button
                  type="button"
                  aria-expanded={showInstall}
                  aria-controls={installId}
                  onClick={() => setShowInstall((v) => !v)}
                  className="t focus-ring -mx-1 -my-0.5 flex items-center gap-1.5 rounded-md px-1 py-0.5 text-left font-medium text-ink hover:text-accent pointer-coarse:-my-[0.8571rem] pointer-coarse:min-h-[3.1429rem]"
                >
                  Helper installed
                  <span className="font-normal text-ink-2">
                    {showInstall ? 'Hide command' : 'Show command'}
                  </span>
                  <ChevronRight
                    size={14}
                    absoluteStrokeWidth
                    strokeWidth={1.5}
                    aria-hidden="true"
                    className={cn('t shrink-0 text-ink-3', showInstall && 'rotate-90')}
                  />
                </button>
              )}
              {installOpen && (
                <div id={installId} className={cn(installDone && 'mt-3')}>
                  <p className="font-medium text-ink">
                    {outdated ? 'Update the helper' : 'Paste this into Terminal and press Enter'}
                  </p>
                  <div className="mt-2 flex gap-2">
                    <div className="flex min-w-0 flex-1 items-center rounded-md border border-line-input bg-surface-1 pointer-coarse:min-h-[3.1429rem]">
                      {/* Scrolls sideways (focusable for keyboard scrolling); one click selects it all. */}
                      <div
                        role="group"
                        tabIndex={0}
                        aria-label="Install command"
                        className={cn(
                          'focus-ring-inset min-w-0 flex-1 overflow-x-auto rounded-md py-2 pr-6 pl-3 font-mono text-xs whitespace-nowrap text-ink [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
                          EDGE_FADE,
                        )}
                      >
                        <code className="select-all">{command}</code>
                      </div>
                    </div>
                    <Button
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
                    {touch ? (
                      'Run this in a terminal on the computer where you use Claude Code. '
                    ) : isMac ? (
                      <>
                        Open Terminal with <Keys keys={['⌘', 'Space']} />, type “Terminal”, then
                        press <Kbd>{ENTER_KEY}</Kbd>. The helper starts automatically when you log
                        in.{' '}
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
                </div>
              )}
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
