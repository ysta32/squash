import { useEffect, useRef, useState } from 'react'
import { Check, Copy, RefreshCw, Share2, X } from 'lucide-react'
import { useFocusTrap } from '../hooks/useFocusTrap'
import { inviteUrl, friendlyError } from '../hooks/useWorkspaces'
import type { Workspace } from '../lib/types'
import { cn } from '../lib/utils'
import { Button, Field, Input, dialogOverlayClass, dialogPanelClass } from './ui'

interface InviteDialogProps {
  workspace: Workspace
  open: boolean
  onClose: () => void
  canRegenerate: boolean
  onRegenerate?: () => Promise<string>
}

export function InviteDialog({
  workspace,
  open,
  onClose,
  canRegenerate,
  onRegenerate,
}: InviteDialogProps) {
  const [override, setOverride] = useState<{ base: string; code: string } | null>(null)
  const code =
    override && override.base === workspace.invite_code ? override.code : workspace.invite_code
  const [copied, setCopied] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const dialogRef = useRef<HTMLDivElement>(null)
  useFocusTrap(dialogRef, open)

  useEffect(() => {
    if (!copied) return
    const t = setTimeout(() => setCopied(false), 2000)
    return () => clearTimeout(t)
  }, [copied])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  const url = inviteUrl(code)
  const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function'

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
    } catch {
      setError('Could not copy. Select the link and copy it manually.')
    }
  }

  const share = async () => {
    try {
      await navigator.share({ title: `Join ${workspace.name} on Squash`, url })
    } catch (err) {
      if (!(err instanceof DOMException && err.name === 'AbortError')) setError(friendlyError(err))
    }
  }

  const regenerate = async () => {
    if (!onRegenerate) return
    setBusy(true)
    setError(null)
    try {
      setOverride({ base: workspace.invite_code, code: await onRegenerate() })
      setConfirming(false)
    } catch (err) {
      setError(friendlyError(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      className={cn(dialogOverlayClass, 'flex items-center justify-center p-4')}
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Invite people"
        className={cn(dialogPanelClass, 'max-w-md p-5 text-fg')}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="truncate text-base font-semibold">Invite to {workspace.name}</h2>
            <p className="mt-1 text-sm text-muted">Anyone with this link can join.</p>
          </div>
          <Button
            variant="ghost"
            aria-label="Close"
            onClick={onClose}
            className="-mt-1 -mr-1 size-8 px-0"
          >
            <X className="size-4" aria-hidden="true" />
          </Button>
        </div>

        <Field label="Invite link" className="mt-5">
          {({ id, describedBy }) => (
            <Input
              id={id}
              aria-describedby={describedBy}
              readOnly
              value={url}
              onFocus={(e) => e.currentTarget.select()}
            />
          )}
        </Field>

        <div className="mt-3 flex gap-2">
          <Button variant="primary" onClick={() => void copy()} className="flex-1">
            {copied ? (
              <Check className="size-4" aria-hidden="true" />
            ) : (
              <Copy className="size-4" aria-hidden="true" />
            )}
            {copied ? 'Copied' : 'Copy link'}
          </Button>
          {canShare && (
            <Button aria-label="Share" onClick={() => void share()} className="w-9 px-0">
              <Share2 className="size-4" aria-hidden="true" />
            </Button>
          )}
        </div>
        <p role="status" className="sr-only">
          {copied ? 'Link copied to clipboard' : ''}
        </p>

        <div className="mt-4 rounded-lg border border-border bg-bg-subtle px-4 py-3 text-center">
          <div className="text-[11px] font-medium tracking-wide text-muted uppercase">
            Invite code
          </div>
          <div className="mt-1 font-mono text-2xl font-semibold tracking-[0.2em]">{code}</div>
        </div>

        {canRegenerate && onRegenerate && (
          <div className="-mx-5 mt-5 -mb-5 rounded-b-xl border-t border-border bg-bg-subtle/60 px-5 py-3 text-sm">
            {confirming ? (
              <div>
                <p className="text-muted">This invalidates the current link and code. Continue?</p>
                <div className="mt-2 flex justify-end gap-2">
                  <Button size="sm" onClick={() => setConfirming(false)}>
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    variant="danger"
                    disabled={busy}
                    onClick={() => void regenerate()}
                  >
                    Yes, regenerate
                  </Button>
                </div>
              </div>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setConfirming(true)}
                className="-ml-2.5"
              >
                <RefreshCw className="size-3.5" aria-hidden="true" /> Regenerate
              </Button>
            )}
          </div>
        )}

        {error && (
          <p role="alert" className="mt-3 text-sm text-danger">
            {error}
          </p>
        )}
      </div>
    </div>
  )
}
