import { useCallback, useLayoutEffect, useRef, useState } from 'react'
import { AlertCircle, ArrowLeft, Bot, Check, Mic, RotateCcw, RotateCw } from 'lucide-react'
import { useSignedUrl } from '../hooks/useSignedUrl'
import type {
  Bug,
  BugAttachment,
  BugWithMeta,
  PendingUpload,
  Severity,
  WorkspaceMember,
} from '../lib/types'
import { SEVERITIES, SEVERITY_COLOR, SEVERITY_LABEL } from '../lib/types'
import { cn, relativeTime } from '../lib/utils'
import { Avatar } from './Avatar'
import { CommentThread } from './CommentThread'
import { Lightbox } from './Lightbox'
import { ResolvePopover } from './ResolvePopover'

export type BugPatch = Partial<Pick<Bug, 'title' | 'description' | 'severity'>>

export interface BugDetailProps {
  bug: BugWithMeta | null
  members: WorkspaceMember[]
  selfId: string
  onUpdate: (id: string, patch: BugPatch) => void | Promise<void>
  onResolve: (id: string, note: string | null) => void | Promise<void>
  onReopen: (id: string, note: string | null) => void | Promise<void>
  onBack: () => void
  /** Counter bumped by the keyboard shortcut to open the Resolve popover. */
  resolveRequest?: number
  /** Counter bumped by the keyboard shortcut to open the Reopen popover. */
  reopenRequest?: number
  onToast?: (msg: string) => void
  /** Retries this bug's failed screenshot uploads. */
  onRetryUploads?: () => void
  /** Sends this bug to Claude Code (or copies it when the local bridge is not running). */
  onExport?: (bug: BugWithMeta) => void
  bridge?: boolean
}

type PopoverState = { bugId: string; mode: 'resolve' | 'reopen' } | null

export function BugDetail(props: BugDetailProps) {
  const { bug, resolveRequest, reopenRequest } = props
  const [popover, setPopover] = useState<PopoverState>(null)
  const [seenResolve, setSeenResolve] = useState(resolveRequest)
  const [seenReopen, setSeenReopen] = useState(reopenRequest)
  const [seenBugId, setSeenBugId] = useState(bug?.id ?? null)

  // A popover belongs to one bug: switching bugs (or deselecting) closes it.
  const bugId = bug?.id ?? null
  if (bugId !== seenBugId) {
    setSeenBugId(bugId)
    setPopover(null)
  }

  // Open the matching popover when a request counter changes (initial value is ignored).
  if (resolveRequest !== seenResolve) {
    setSeenResolve(resolveRequest)
    if (bug && !bug.optimistic && bug.status === 'open') {
      setPopover({ bugId: bug.id, mode: 'resolve' })
    }
  }
  if (reopenRequest !== seenReopen) {
    setSeenReopen(reopenRequest)
    if (bug && !bug.optimistic && bug.status === 'resolved') {
      setPopover({ bugId: bug.id, mode: 'reopen' })
    }
  }

  if (!bug) {
    return (
      <div className="hidden h-full items-center justify-center text-sm text-muted md:flex">
        Select a bug
      </div>
    )
  }

  const activePopover = popover && popover.bugId === bug.id ? popover.mode : null

  return (
    <BugBody
      key={bug.id}
      {...props}
      bug={bug}
      popover={activePopover}
      onPopover={(mode) => setPopover(mode ? { bugId: bug.id, mode } : null)}
    />
  )
}

interface BugBodyProps extends BugDetailProps {
  bug: BugWithMeta
  popover: 'resolve' | 'reopen' | null
  onPopover: (mode: 'resolve' | 'reopen' | null) => void
}

interface GalleryItem {
  key: string
  url: string | null
}

function BugBody({
  bug,
  members,
  onUpdate,
  onResolve,
  onReopen,
  onBack,
  onToast,
  onRetryUploads,
  onExport,
  bridge = false,
  popover,
  onPopover,
}: BugBodyProps) {
  const [titleDraft, setTitleDraft] = useState<string | null>(null)
  const [descDraft, setDescDraft] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [signed, setSigned] = useState<Record<string, string>>({})
  const [lightboxKey, setLightboxKey] = useState<string | null>(null)
  const descRef = useRef<HTMLTextAreaElement>(null)
  /** Set by Esc so the blur that follows discards the draft instead of saving it. */
  const cancelRef = useRef(false)

  const profiles = new Map(members.map((m) => [m.user_id, m.profile]))
  const filer = profiles.get(bug.filed_by) ?? null
  const resolver = bug.resolved_by ? (profiles.get(bug.resolved_by) ?? null) : null
  const editable = !bug.optimistic
  const isOpen = bug.status === 'open'

  const description = descDraft ?? bug.description
  useLayoutEffect(() => {
    const el = descRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [description])

  function run(action: () => void | Promise<void>, onSuccess?: () => void) {
    setError(null)
    Promise.resolve()
      .then(action)
      .then(onSuccess, (err: unknown) => {
        const msg = err instanceof Error ? err.message : 'Something went wrong.'
        setError(msg)
        onToast?.(msg)
      })
  }

  // Drafts survive a failed save (so nothing typed is lost) and are cleared only once the update
  // resolves — and only if the user hasn't kept typing since the save was sent.
  function saveTitle() {
    const draft = titleDraft
    if (draft === null) return
    if (cancelRef.current) {
      cancelRef.current = false
      setTitleDraft(null)
      return
    }
    const next = draft.trim()
    if (!next || next === bug.title) {
      setTitleDraft(null)
      return
    }
    run(
      () => onUpdate(bug.id, { title: next }),
      () => setTitleDraft((d) => (d === draft ? null : d)),
    )
  }

  function saveDescription() {
    const draft = descDraft
    if (draft === null) return
    if (cancelRef.current) {
      cancelRef.current = false
      setDescDraft(null)
      return
    }
    if (draft === bug.description) {
      setDescDraft(null)
      return
    }
    run(
      () => onUpdate(bug.id, { description: draft }),
      () => setDescDraft((d) => (d === draft ? null : d)),
    )
  }

  function setSeverity(severity: Severity) {
    if (severity !== bug.severity) run(() => onUpdate(bug.id, { severity }))
  }

  function confirmPopover(note: string | null) {
    onPopover(null)
    // Act on the bug's current status: the popover label always mirrors it.
    if (isOpen) run(() => onResolve(bug.id, note))
    else run(() => onReopen(bug.id, note))
  }

  const onSigned = useCallback((path: string, url: string | null) => {
    if (!url) return
    setSigned((prev) => (prev[path] === url ? prev : { ...prev, [path]: url }))
  }, [])

  const pending = bug.pending ?? []
  const gallery: GalleryItem[] = [
    ...bug.attachments.map((a) => ({ key: a.id, url: signed[a.storage_path] ?? null })),
    ...pending.map((p) => ({ key: p.localId, url: p.previewUrl })),
  ]
  const viewable = gallery.filter((g): g is { key: string; url: string } => g.url !== null)
  const lightboxIndex = lightboxKey ? viewable.findIndex((g) => g.key === lightboxKey) : -1

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      <div className="flex items-center gap-3 px-6 pt-4">
        <button
          type="button"
          onClick={onBack}
          aria-label="Back"
          className="-ml-2 rounded-md p-1.5 text-muted hover:bg-bg-subtle hover:text-fg md:hidden"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <span className="font-mono text-xs text-muted">#{bug.optimistic ? '…' : bug.number}</span>
        <div role="group" aria-label="Severity" className="flex items-center gap-1">
          {SEVERITIES.map((s) => {
            const active = s === bug.severity
            return (
              <button
                key={s}
                type="button"
                disabled={!editable}
                aria-label={`Severity: ${SEVERITY_LABEL[s]}`}
                aria-pressed={active}
                title={SEVERITY_LABEL[s]}
                onClick={() => setSeverity(s)}
                className="rounded p-1 hover:bg-bg-subtle disabled:cursor-default"
              >
                <span
                  className={cn(
                    'block h-2 w-2 rounded-full',
                    SEVERITY_COLOR[s],
                    !active && 'opacity-25',
                  )}
                />
              </button>
            )
          })}
        </div>
        {onExport && (
          <button
            type="button"
            disabled={!editable}
            onClick={() => onExport(bug)}
            title={
              bridge ? 'Open Claude Code on this bug (C)' : 'Copy a prompt for Claude Code (C)'
            }
            className="ml-auto inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-2 text-sm text-fg hover:bg-bg-subtle disabled:opacity-50"
          >
            <Bot className="h-4 w-4" />
            {bridge ? 'Send to Claude' : 'Copy for Claude'}
          </button>
        )}
        <div className={cn('relative', !onExport && 'ml-auto')}>
          <button
            type="button"
            disabled={!editable}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={() => onPopover(popover ? null : isOpen ? 'resolve' : 'reopen')}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-md px-4 py-2 text-sm font-medium disabled:opacity-50',
              isOpen
                ? 'bg-accent text-accent-fg hover:opacity-90'
                : 'border border-border text-fg hover:bg-bg-subtle',
            )}
          >
            {isOpen ? <Check className="h-4 w-4" /> : <RotateCcw className="h-4 w-4" />}
            {isOpen ? 'Resolve' : 'Reopen'}
          </button>
          <ResolvePopover
            mode={isOpen ? 'resolve' : 'reopen'}
            open={popover !== null && editable}
            onClose={() => onPopover(null)}
            onConfirm={confirmPopover}
          />
        </div>
      </div>

      <section className="px-6 pt-3 pb-4">
        <input
          value={titleDraft ?? bug.title}
          readOnly={!editable}
          aria-label="Title"
          onChange={(e) => setTitleDraft(e.target.value)}
          onBlur={saveTitle}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              e.currentTarget.blur()
            } else if (e.key === 'Escape') {
              e.preventDefault()
              cancelRef.current = true
              setTitleDraft(null)
              e.currentTarget.blur()
              cancelRef.current = false
            }
          }}
          className="w-full bg-transparent text-xl font-semibold tracking-tight outline-none"
        />
        <div className="mt-2 space-y-1 text-xs text-muted">
          <p className="flex items-center gap-1.5">
            <Avatar profile={filer} size="xs" />
            <span>
              Filed by <span className="text-fg">{filer?.display_name ?? 'Deleted user'}</span> ·{' '}
              <time dateTime={bug.created_at} title={new Date(bug.created_at).toLocaleString()}>
                {relativeTime(bug.created_at)}
              </time>
            </span>
          </p>
          {bug.status === 'resolved' && (
            <>
              <p className="flex items-center gap-1.5">
                <Avatar profile={resolver} size="xs" />
                <span>
                  Resolved by{' '}
                  <span className="text-fg">{resolver?.display_name ?? 'Deleted user'}</span>
                  {bug.resolved_at && (
                    <>
                      {' · '}
                      <time
                        dateTime={bug.resolved_at}
                        title={new Date(bug.resolved_at).toLocaleString()}
                      >
                        {relativeTime(bug.resolved_at)}
                      </time>
                    </>
                  )}
                </span>
              </p>
              {bug.resolution_note && (
                <blockquote className="ml-6 border-l-2 border-border pl-2 whitespace-pre-wrap italic">
                  “{bug.resolution_note}”
                </blockquote>
              )}
            </>
          )}
        </div>
        {error && (
          <p role="alert" className="mt-2 flex items-center gap-1 text-xs text-red-500">
            <AlertCircle className="h-3.5 w-3.5" />
            {error}
          </p>
        )}
      </section>

      <section className="border-t border-border px-6 py-4">
        <textarea
          ref={descRef}
          value={description}
          readOnly={!editable}
          rows={1}
          aria-label="Description"
          placeholder="Add a description…"
          onChange={(e) => setDescDraft(e.target.value)}
          onBlur={saveDescription}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              e.preventDefault()
              cancelRef.current = true
              setDescDraft(null)
              e.currentTarget.blur()
              cancelRef.current = false
            }
          }}
          className="w-full resize-none overflow-hidden bg-transparent text-sm leading-relaxed outline-none placeholder:text-muted"
        />
        {bug.transcript !== null && (
          <div className="mt-3 rounded-md bg-bg-subtle px-3 py-2 text-xs text-muted">
            <p className="mb-1 flex items-center gap-1 font-medium">
              <Mic className="h-3 w-3" aria-hidden="true" />
              Voice transcript
            </p>
            <p className="whitespace-pre-wrap">{bug.transcript}</p>
          </div>
        )}
      </section>

      {gallery.length > 0 && (
        <section className="border-t border-border px-6 py-4">
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {bug.attachments.map((a, i) => (
              <AttachmentThumb
                key={a.id}
                attachment={a}
                label={`Open screenshot ${i + 1}`}
                onSigned={onSigned}
                onOpen={() => setLightboxKey(a.id)}
              />
            ))}
            {pending.map((p, i) => (
              <PendingThumb
                key={p.localId}
                upload={p}
                label={`Open screenshot ${bug.attachments.length + i + 1}`}
                onOpen={() => setLightboxKey(p.localId)}
                onRetry={onRetryUploads}
              />
            ))}
          </div>
        </section>
      )}

      <CommentThread bugId={bug.optimistic ? null : bug.id} members={members} />

      {lightboxIndex >= 0 && (
        <Lightbox
          urls={viewable.map((g) => g.url)}
          index={lightboxIndex}
          onClose={() => setLightboxKey(null)}
          onIndex={(i) => setLightboxKey(viewable[i]?.key ?? null)}
        />
      )}
    </div>
  )
}

const THUMB_CLASS =
  'relative block aspect-video overflow-hidden rounded-md border border-border bg-bg-subtle'

function AttachmentThumb({
  attachment,
  label,
  onSigned,
  onOpen,
}: {
  attachment: BugAttachment
  label: string
  onSigned: (path: string, url: string | null) => void
  onOpen: () => void
}) {
  const url = useSignedUrl(attachment.storage_path)
  useLayoutEffect(() => {
    onSigned(attachment.storage_path, url)
  }, [attachment.storage_path, url, onSigned])

  return (
    <button
      type="button"
      aria-label={label}
      disabled={!url}
      onClick={onOpen}
      className={cn(THUMB_CLASS, 'cursor-zoom-in disabled:cursor-default')}
    >
      {url ? (
        <img src={url} alt="" className="h-full w-full object-cover" />
      ) : (
        <span className="absolute inset-0 animate-pulse bg-bg-subtle" />
      )}
    </button>
  )
}

function PendingThumb({
  upload,
  label,
  onOpen,
  onRetry,
}: {
  upload: PendingUpload
  label: string
  onOpen: () => void
  onRetry?: () => void
}) {
  const uploading = !upload.error && upload.progress < 1
  const r = 9
  const circumference = 2 * Math.PI * r
  const shown = Math.max(0.25, Math.min(1, upload.progress))

  return (
    <div className="relative">
      <button
        type="button"
        aria-label={label}
        onClick={onOpen}
        className={cn(THUMB_CLASS, 'cursor-zoom-in')}
      >
        <img
          src={upload.previewUrl}
          alt=""
          className={cn('h-full w-full object-cover', uploading && 'opacity-60')}
        />
        {uploading && (
          <span className="absolute inset-0 flex items-center justify-center">
            <svg
              viewBox="0 0 24 24"
              className="h-6 w-6 animate-spin"
              role="progressbar"
              aria-label="Uploading"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(upload.progress * 100)}
            >
              <circle
                cx="12"
                cy="12"
                r={r}
                fill="none"
                stroke="white"
                strokeOpacity="0.35"
                strokeWidth="3"
              />
              <circle
                cx="12"
                cy="12"
                r={r}
                fill="none"
                stroke="white"
                strokeWidth="3"
                strokeLinecap="round"
                strokeDasharray={`${shown * circumference} ${circumference}`}
                transform="rotate(-90 12 12)"
              />
            </svg>
          </span>
        )}
        {upload.error && (
          <span className="absolute right-1 bottom-1 left-1 rounded bg-red-500 px-1.5 py-0.5 text-center text-[10px] font-medium text-white">
            Upload failed
          </span>
        )}
      </button>
      {upload.error && onRetry && (
        <button
          type="button"
          aria-label="Retry upload"
          title="Retry upload"
          onClick={onRetry}
          className="absolute top-1 right-1 inline-flex items-center gap-1 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-medium text-white hover:bg-black/85"
        >
          <RotateCw size={10} aria-hidden="true" />
          Retry
        </button>
      )}
    </div>
  )
}
