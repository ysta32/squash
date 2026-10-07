import { useEffect, useRef, useState } from 'react'
import { Check, Copy, RefreshCw, Share2, X } from 'lucide-react'
import { useFocusTrap } from '../hooks/useFocusTrap'
import { inviteUrl, friendlyError } from '../hooks/useWorkspaces'
import type { Workspace } from '../lib/types'
import { cn } from '../lib/utils'
import { Button, Field, Input } from './ui'
import {
  closeButtonClass,
  dialogClass,
  dialogTitleClass,
  eyebrowClass,
  scrimClass,
} from './dialogStyles'

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
      className={cn(scrimClass, 'flex items-center justify-center p-3 sm:p-6')}
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Invite people"
        className={cn(dialogClass, 'max-w-120 p-6')}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className={cn(dialogTitleClass, 'truncate')}>Invite to {workspace.name}</h2>
            <p className="mt-1 text-sm text-ink-2">Anyone with this link can join.</p>
          </div>
          <button type="button" aria-label="Close" onClick={onClose} className={closeButtonClass}>
            <X size={16} absoluteStrokeWidth strokeWidth={1.5} aria-hidden="true" />
          </button>
        </div>

        <Field label="Invite link" className="mt-6">
          {({ id, describedBy }) => (
            <Input
              id={id}
              aria-describedby={describedBy}
              readOnly
              value={url}
              onFocus={(e) => e.currentTarget.select()}
              className="font-mono text-xs"
            />
          )}
        </Field>

        <div className="mt-4 flex items-baseline justify-between gap-4 border-y border-line py-3">
          <span className={eyebrowClass}>Invite code</span>
          <span className="font-mono text-lg font-medium tracking-[0.2em] text-ink nums">
            {code}
          </span>
        </div>

        <p role="status" className="sr-only">
          {copied ? 'Link copied to clipboard' : ''}
        </p>

        {error && (
          <p role="alert" className="mt-4 text-sm text-danger">
            {error}
          </p>
        )}

        {confirming ? (
          <div className="mt-6">
            <p className="text-sm text-ink-2">
              This invalidates the current link and code. Continue?
            </p>
            <div className="mt-3 flex justify-end gap-2">
              <Button onClick={() => setConfirming(false)}>Cancel</Button>
              <Button variant="danger" disabled={busy} onClick={() => void regenerate()}>
                Yes, regenerate
              </Button>
            </div>
          </div>
        ) : (
          <div className="mt-6 flex flex-wrap items-center gap-2">
            {canRegenerate && onRegenerate && (
              <Button variant="ghost" onClick={() => setConfirming(true)} className="-ml-3">
                <RefreshCw size={14} absoluteStrokeWidth strokeWidth={1.5} aria-hidden="true" />
                Regenerate
              </Button>
            )}
            <div className="ml-auto flex gap-2">
              {canShare && (
                <Button onClick={() => void share()}>
                  <Share2 size={16} absoluteStrokeWidth strokeWidth={1.5} aria-hidden="true" />
                  Share
                </Button>
              )}
              <Button variant="primary" onClick={() => void copy()} className="min-w-31">
                {copied ? (
                  <Check size={16} absoluteStrokeWidth strokeWidth={1.5} aria-hidden="true" />
                ) : (
                  <Copy size={16} absoluteStrokeWidth strokeWidth={1.5} aria-hidden="true" />
                )}
                {copied ? 'Copied' : 'Copy link'}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
