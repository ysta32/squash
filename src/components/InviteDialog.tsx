import { useEffect, useRef, useState } from 'react'
import { Check, Copy, RefreshCw, Share2 } from 'lucide-react'
import { useFocusTrap } from '../hooks/useFocusTrap'
import { inviteUrl, friendlyError } from '../hooks/useWorkspaces'
import type { Workspace } from '../lib/types'
import { cn } from '../lib/utils'
import { Button, Field, Input } from './ui'
import { DialogHeader } from './DialogHeader'
import {
  dialogActionsClass,
  dialogClass,
  dialogMaxHeightClass,
  dialogPositionClass,
  eyebrowClass,
  scrimClass,
} from './dialogStyles'

/** Full-width 44px buttons on phones; regular height from 480px unless the pointer is coarse. */
const TOUCH = 'max-[479px]:h-11 max-[479px]:w-full pointer-coarse:h-11'
/** Footer actions stack (primary on top) below 480px. */
const STACK = 'max-[479px]:flex-col-reverse max-[479px]:items-stretch'

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
  useFocusTrap(dialogRef, open, { initialFocus: 'field' })

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
    <div className={cn(scrimClass, dialogPositionClass)} onClick={onClose}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Invite people"
        className={cn(dialogClass, dialogMaxHeightClass, 'max-w-120 overflow-y-auto p-6')}
        onClick={(e) => e.stopPropagation()}
      >
        <DialogHeader
          eyebrow="Workspace · invite"
          title={<span className="block truncate">Invite to {workspace.name}</span>}
          onClose={onClose}
        >
          <p className="mt-1 text-sm text-ink-2">Anyone with this link can join.</p>
        </DialogHeader>

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
            <div className={cn('mt-3 flex flex-wrap items-center justify-end gap-2', STACK)}>
              {/* Focus lands on the safe choice; the Regenerate button that had it is gone. */}
              <Button autoFocus onClick={() => setConfirming(false)} className={TOUCH}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                disabled={busy}
                onClick={() => void regenerate()}
                className={TOUCH}
              >
                Yes, regenerate
              </Button>
            </div>
          </div>
        ) : (
          // Same weights as the settings invite row: Copy link and Regenerate are both secondary.
          // Phones stack Copy link, Share, then Regenerate; wider screens put Regenerate on the left.
          <div className={cn(dialogActionsClass, STACK)}>
            {canRegenerate && onRegenerate && (
              <Button
                onClick={() => setConfirming(true)}
                className={cn(TOUCH, 'min-[480px]:mr-auto')}
              >
                <RefreshCw size={16} absoluteStrokeWidth strokeWidth={1.5} aria-hidden="true" />
                Regenerate
              </Button>
            )}
            {canShare && (
              <Button onClick={() => void share()} className={TOUCH}>
                <Share2 size={16} absoluteStrokeWidth strokeWidth={1.5} aria-hidden="true" />
                Share
              </Button>
            )}
            <Button onClick={() => void copy()} className={cn(TOUCH, 'min-[480px]:min-w-31')}>
              {copied ? (
                <Check size={16} absoluteStrokeWidth strokeWidth={1.5} aria-hidden="true" />
              ) : (
                <Copy size={16} absoluteStrokeWidth strokeWidth={1.5} aria-hidden="true" />
              )}
              {copied ? 'Copied' : 'Copy link'}
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
