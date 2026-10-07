import { useEffect, useState } from 'react'
import { Check, Copy, RefreshCw, Share2, X } from 'lucide-react'
import { inviteUrl, friendlyError } from '../hooks/useWorkspaces'
import type { Workspace } from '../lib/types'
import { Button, Field, Input } from './ui'

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
      className="fixed inset-0 z-50 flex items-center justify-center bg-fg/40 p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Invite people"
        className="w-full max-w-md rounded-xl border border-border bg-bg-elevated p-6 text-fg shadow-elevated"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold">Invite to {workspace.name}</h2>
            <p className="mt-1 text-sm text-muted">Anyone with this link can join.</p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            aria-label="Close"
            onClick={onClose}
            className="w-7 px-0"
          >
            <X size={16} />
          </Button>
        </div>

        <Field label="Invite link" className="mt-4">
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
            {copied ? <Check size={16} /> : <Copy size={16} />}
            {copied ? 'Copied' : 'Copy link'}
          </Button>
          {canShare && (
            <Button aria-label="Share" onClick={() => void share()}>
              <Share2 size={16} />
            </Button>
          )}
        </div>
        <p role="status" className="sr-only">
          {copied ? 'Link copied to clipboard' : ''}
        </p>

        <div className="mt-5 text-center">
          <div className="text-xs uppercase tracking-wide text-muted">Invite code</div>
          <div className="mt-1 font-mono text-3xl font-semibold tracking-widest">{code}</div>
        </div>

        {canRegenerate && onRegenerate && (
          <div className="mt-5 border-t border-border pt-4 text-sm">
            {confirming ? (
              <div>
                <p className="text-muted">This invalidates the current link and code. Continue?</p>
                <div className="mt-2 flex gap-2">
                  <Button variant="danger" disabled={busy} onClick={() => void regenerate()}>
                    Yes, regenerate
                  </Button>
                  <Button onClick={() => setConfirming(false)}>Cancel</Button>
                </div>
              </div>
            ) : (
              <Button variant="ghost" onClick={() => setConfirming(true)}>
                <RefreshCw size={14} /> Regenerate
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
