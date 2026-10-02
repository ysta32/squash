import { useEffect, useState } from 'react'
import { Check, Copy, RefreshCw, Share2, X } from 'lucide-react'
import { inviteUrl, friendlyError } from '../hooks/useWorkspaces'
import type { Workspace } from '../lib/types'

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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Invite people"
        className="w-full max-w-md rounded-xl border border-[var(--border)] bg-[var(--bg)] p-6 text-[var(--fg)] shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-base font-semibold">Invite to {workspace.name}</h2>
            <p className="mt-1 text-sm text-[var(--muted)]">Anyone with this link can join.</p>
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="rounded p-1 text-[var(--muted)] hover:text-[var(--fg)]"
          >
            <X size={16} />
          </button>
        </div>

        <input
          readOnly
          value={url}
          aria-label="Invite link"
          onFocus={(e) => e.currentTarget.select()}
          className="mt-4 w-full rounded-md border border-[var(--border)] bg-transparent px-3 py-2 text-sm"
        />

        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={() => void copy()}
            className="flex flex-1 items-center justify-center gap-2 rounded-md bg-[var(--accent)] px-4 py-3 text-sm font-medium text-white"
          >
            {copied ? <Check size={16} /> : <Copy size={16} />}
            {copied ? 'Copied' : 'Copy link'}
          </button>
          {canShare && (
            <button
              type="button"
              aria-label="Share"
              onClick={() => void share()}
              className="rounded-md border border-[var(--border)] px-4 py-3"
            >
              <Share2 size={16} />
            </button>
          )}
        </div>

        <div className="mt-5 text-center">
          <div className="text-xs uppercase tracking-wide text-[var(--muted)]">Invite code</div>
          <div className="mt-1 font-mono text-3xl font-semibold tracking-widest">{code}</div>
        </div>

        {canRegenerate && onRegenerate && (
          <div className="mt-5 border-t border-[var(--border)] pt-4 text-sm">
            {confirming ? (
              <div>
                <p className="text-[var(--muted)]">
                  This invalidates the current link and code. Continue?
                </p>
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void regenerate()}
                    className="rounded-md bg-red-500 px-3 py-1.5 text-white disabled:opacity-50"
                  >
                    Yes, regenerate
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirming(false)}
                    className="rounded-md border border-[var(--border)] px-3 py-1.5"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirming(true)}
                className="flex items-center gap-1.5 text-[var(--muted)] hover:text-[var(--fg)]"
              >
                <RefreshCw size={14} /> Regenerate
              </button>
            )}
          </div>
        )}

        {error && <p className="mt-3 text-sm text-red-500">{error}</p>}
      </div>
    </div>
  )
}
