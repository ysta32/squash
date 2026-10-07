import { formatContext, sanitizeContext } from '../lib/bugContext'
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import {
  AlertCircle,
  ArrowLeft,
  Bot,
  Bug as BugIcon,
  Check,
  Copy,
  Lightbulb,
  Mic,
  MousePointerClick,
  RotateCcw,
  RotateCw,
  Trash2,
} from 'lucide-react'
import { useOverlayOpen } from '../hooks/useKeyboard'
import { useSignedUrl } from '../hooks/useSignedUrl'
import type { ClaudeRun } from '../lib/claudeExport'
import type {
  Bug,
  BugAttachment,
  BugWithMeta,
  PendingUpload,
  Severity,
  WorkspaceMember,
} from '../lib/types'
import { KIND_LABEL } from '../lib/types'
import { Markdown } from '../lib/markdown'
import { cn, relativeTime } from '../lib/utils'
import { AssigneePicker } from './AssigneePicker'
import { Avatar } from './Avatar'
import { SeverityPicker } from './SeverityPicker'
import { ClaudeProgress } from './ClaudeProgress'
import { CommentThread } from './CommentThread'
import { Lightbox } from './Lightbox'
import { ResolvePopover } from './ResolvePopover'
import { Kbd, buttonClass } from './ui'

export type BugPatch = Partial<Pick<Bug, 'title' | 'description' | 'severity' | 'kind'>>

export interface BugDetailProps {
  bug: BugWithMeta | null
  members: WorkspaceMember[]
  selfId: string
  onUpdate: (id: string, patch: BugPatch) => void | Promise<void>
  onResolve: (id: string, note: string | null) => void | Promise<void>
  onReopen: (id: string, note: string | null) => void | Promise<void>
  /** Sets the assignee, or clears it with null. Without it the assignee is read-only. */
  onAssign?: (id: string, userId: string | null) => void | Promise<void>
  /** Counter bumped by the keyboard shortcut to open the assignee picker. */
  assignRequest?: number
  /**
   * Permanently deletes the bug (after the user confirms). Only offered to the member who filed
   * the bug and to the workspace owner, matching the bugs_delete policy (0005_hardening.sql).
   */
  onDelete?: (id: string) => Promise<void>
  onBack: () => void
  /** Counter bumped by the keyboard shortcut to open the Resolve popover. */
  resolveRequest?: number
  /** Counter bumped by the keyboard shortcut to open the Reopen popover. */
  reopenRequest?: number
  onToast?: (msg: string) => void
  /** Retries this bug's failed screenshot uploads. */
  onRetryUploads?: () => void
  /** Opens Claude Code on this bug (or the setup guide when the helper is not connected). */
  onSend?: (bug: BugWithMeta) => void
  /** Copies a ready-to-paste Claude Code prompt for this bug. */
  onCopy?: (bug: BugWithMeta) => void
  /** The latest Claude Code session sent this bug, with what it is doing. */
  claudeRun?: ClaudeRun
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
      <div className="hidden h-full flex-col items-center justify-center gap-2 px-6 text-center md:flex">
        <MousePointerClick className="h-6 w-6 text-muted" aria-hidden="true" />
        <p className="text-sm text-muted">Select a bug to see its details</p>
        <p className="text-xs text-muted">
          <Kbd>J</Kbd>/<Kbd>K</Kbd> to move, <Kbd>N</Kbd> to file one
        </p>
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
  selfId,
  onUpdate,
  onResolve,
  onReopen,
  onAssign,
  assignRequest,
  onDelete,
  onBack,
  onToast,
  onRetryUploads,
  onSend,
  onCopy,
  claudeRun,
  popover,
  onPopover,
}: BugBodyProps) {
  const [titleDraft, setTitleDraft] = useState<string | null>(null)
  const titleRef = useRef<HTMLTextAreaElement>(null)
  const [descDraft, setDescDraft] = useState<string | null>(null)
  const [descFocused, setDescFocused] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [signed, setSigned] = useState<Record<string, string>>({})
  const [lightboxKey, setLightboxKey] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const descRef = useRef<HTMLTextAreaElement>(null)
  /** Set by Esc so the blur that follows discards the draft instead of saving it. */
  const cancelRef = useRef(false)

  const profiles = new Map(members.map((m) => [m.user_id, m.profile]))
  const filer = profiles.get(bug.filed_by) ?? null
  const resolver = bug.resolved_by ? (profiles.get(bug.resolved_by) ?? null) : null
  const editable = !bug.optimistic
  const isOpen = bug.status === 'open'
  const canDelete =
    bug.filed_by === selfId || members.some((m) => m.user_id === selfId && m.role === 'owner')

  const description = descDraft ?? bug.description
  const showRendered = !descFocused && description.trim() !== ''
  useLayoutEffect(() => {
    const el = titleRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [titleDraft, bug.title])

  useEffect(() => {
    const el = titleRef.current
    if (!el || typeof ResizeObserver === 'undefined') return
    let width = el.clientWidth
    let frame = 0
    // Resizing inside the observer callback would trigger a ResizeObserver loop error, so the
    // height is recomputed on the next frame instead.
    const observer = new ResizeObserver(() => {
      if (el.clientWidth === width) return
      width = el.clientWidth
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        el.style.height = 'auto'
        el.style.height = `${el.scrollHeight}px`
      })
    })
    observer.observe(el)
    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
    }
  }, [])

  useLayoutEffect(() => {
    const el = descRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [description, showRendered])

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

  const otherKind = bug.kind === 'feature' ? 'bug' : 'feature'
  const KindIcon = bug.kind === 'feature' ? Lightbulb : BugIcon

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
  const context = sanitizeContext(bug.context)
  const environment = formatContext({ ...context, url: undefined })
  const lightboxIndex = lightboxKey ? viewable.findIndex((g) => g.key === lightboxKey) : -1

  return (
    <div className="h-full min-w-0 overflow-y-auto">
      <div className="mx-auto w-full max-w-3xl min-w-0 px-4 pb-12 sm:px-6">
        {formatContext(context) && (
          <p aria-label="Bug context" className="pt-4 font-mono text-xs break-words text-muted">
            {context.url && (
              <a
                href={context.url}
                target="_blank"
                rel="noopener noreferrer"
                className="focus-ring underline"
              >
                {context.url.replace(/^https?:\/\//, '')}
              </a>
            )}
            {context.url && environment && ' · '}
            {environment}
          </p>
        )}
        <header className="flex flex-wrap items-center gap-2 pt-4">
          <div className="flex min-w-0 items-center gap-1">
            <button
              type="button"
              onClick={onBack}
              aria-label="Back"
              title="Back"
              className="t focus-ring -ml-2 inline-flex h-8 w-8 items-center justify-center rounded-md text-muted hover:bg-bg-subtle hover:text-fg md:hidden"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <span className="px-1 font-mono text-xs font-medium text-muted tabular-nums">
              #{bug.optimistic ? '…' : bug.number}
            </span>
            <button
              type="button"
              disabled={!editable}
              onClick={() => run(() => onUpdate(bug.id, { kind: otherKind }))}
              aria-label={`${KIND_LABEL[bug.kind].one}: move to ${KIND_LABEL[otherKind].many}`}
              title={`Move to ${KIND_LABEL[otherKind].many}`}
              className="t focus-ring inline-flex h-7 items-center gap-1.5 rounded-md px-2 text-xs font-medium text-muted hover:bg-bg-subtle hover:text-fg disabled:cursor-default disabled:hover:bg-transparent disabled:hover:text-muted"
            >
              <KindIcon className="h-3.5 w-3.5" aria-hidden="true" />
              {KIND_LABEL[bug.kind].one}
            </button>
            <span aria-hidden="true" className="mx-1 h-4 w-px bg-border" />
            <SeverityPicker
              value={bug.severity}
              onChange={setSeverity}
              size="sm"
              align="start"
              disabled={!editable}
            />
          </div>

          <div className="ml-auto flex shrink-0 items-center gap-2">
            {(onSend || onCopy) && (
              <div className="inline-flex h-8 items-stretch rounded-md border border-border bg-bg">
                {onSend && (
                  <button
                    type="button"
                    disabled={!editable}
                    onClick={() => onSend(bug)}
                    aria-label="Send to Claude"
                    title="Open Claude Code on this bug (C)"
                    className={cn(
                      't focus-ring inline-flex w-[30px] items-center justify-center gap-1.5 text-sm font-medium whitespace-nowrap text-fg hover:bg-bg-subtle disabled:pointer-events-none disabled:opacity-50 sm:w-auto sm:px-2.5',
                      onCopy ? 'rounded-l-[5px]' : 'rounded-[5px]',
                    )}
                  >
                    <Bot className="h-4 w-4 shrink-0" aria-hidden="true" />
                    <span className="hidden sm:inline">Send to Claude</span>
                  </button>
                )}
                {onSend && onCopy && <span aria-hidden="true" className="w-px bg-border" />}
                {onCopy && (
                  <button
                    type="button"
                    disabled={!editable}
                    onClick={() => onCopy(bug)}
                    aria-label="Copy for Claude"
                    title="Copy a prompt to paste into Claude Code"
                    className={cn(
                      't focus-ring inline-flex w-[30px] items-center justify-center text-muted hover:bg-bg-subtle hover:text-fg disabled:pointer-events-none disabled:opacity-50',
                      onSend ? 'rounded-r-[5px]' : 'rounded-[5px]',
                    )}
                  >
                    <Copy className="h-4 w-4" aria-hidden="true" />
                  </button>
                )}
              </div>
            )}
            <div className="relative">
              <button
                type="button"
                disabled={!editable}
                onMouseDown={(e) => e.stopPropagation()}
                onClick={() => onPopover(popover ? null : isOpen ? 'resolve' : 'reopen')}
                title={isOpen ? 'Resolve (R)' : 'Reopen'}
                className={buttonClass(isOpen ? 'primary' : 'secondary', 'md', 'h-8 gap-1.5 px-3')}
              >
                {isOpen ? (
                  <Check className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <RotateCcw className="h-4 w-4" aria-hidden="true" />
                )}
                {isOpen ? 'Resolve' : 'Reopen'}
              </button>
              <ResolvePopover
                mode={isOpen ? 'resolve' : 'reopen'}
                open={popover !== null && editable}
                onClose={() => onPopover(null)}
                onConfirm={confirmPopover}
              />
            </div>
            {onDelete && canDelete && (
              <button
                type="button"
                disabled={!editable}
                onClick={() => setConfirmDelete(true)}
                aria-label={`Delete ${KIND_LABEL[bug.kind].one.toLowerCase()}`}
                title={`Delete ${KIND_LABEL[bug.kind].one.toLowerCase()}`}
                className="t focus-ring inline-flex h-8 w-8 items-center justify-center rounded-md text-muted hover:bg-danger/10 hover:text-danger disabled:pointer-events-none disabled:opacity-50"
              >
                <Trash2 className="h-4 w-4" aria-hidden="true" />
              </button>
            )}
          </div>
        </header>
        {onDelete && canDelete && confirmDelete && (
          <DeleteDialog
            bug={bug}
            onCancel={() => setConfirmDelete(false)}
            onDelete={() => onDelete(bug.id)}
          />
        )}

        <div className="mt-5">
          <textarea
            ref={titleRef}
            rows={1}
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
            className="block w-full resize-none overflow-hidden bg-transparent text-xl leading-snug font-semibold tracking-tight break-words outline-none sm:text-2xl"
          />
          <div className="mt-3 space-y-2 text-xs text-muted">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
              <p className="flex min-w-0 items-center gap-1.5">
                <Avatar profile={filer} size="xs" />
                <span className="min-w-0 truncate">
                  Filed by <span className="text-fg">{filer?.display_name ?? 'Deleted user'}</span>{' '}
                  ·{' '}
                  <time dateTime={bug.created_at} title={new Date(bug.created_at).toLocaleString()}>
                    {relativeTime(bug.created_at)}
                  </time>
                </span>
              </p>
              <AssigneePicker
                members={members}
                value={bug.assignee_id}
                selfId={selfId}
                disabled={!editable || !onAssign}
                openRequest={assignRequest}
                onChange={(userId) => {
                  if (onAssign) run(() => onAssign(bug.id, userId))
                }}
              />
            </div>
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
                  <blockquote className="ml-2 border-l-2 border-border pl-3 [overflow-wrap:anywhere] whitespace-pre-wrap italic">
                    “{bug.resolution_note}”
                  </blockquote>
                )}
              </>
            )}
          </div>
          {error && (
            <p role="alert" className="mt-3 flex items-center gap-1.5 text-xs text-danger">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              {error}
            </p>
          )}
        </div>

        <div className="mt-8 space-y-8">
          {claudeRun && <ClaudeProgress run={claudeRun} />}

          <section className="relative min-w-0">
            <h2 className={SECTION_HEADING}>Description</h2>
            <textarea
              ref={descRef}
              value={description}
              readOnly={!editable}
              rows={1}
              aria-label="Description"
              placeholder={editable ? 'Add a description…' : 'No description'}
              onChange={(e) => setDescDraft(e.target.value)}
              onFocus={() => setDescFocused(true)}
              onBlur={() => {
                setDescFocused(false)
                saveDescription()
              }}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  e.preventDefault()
                  cancelRef.current = true
                  setDescDraft(null)
                  e.currentTarget.blur()
                  cancelRef.current = false
                }
              }}
              // The sr-only state must not keep w-full: an absolutely positioned full-width
              // textarea stretches the page sideways.
              className={
                showRendered
                  ? 'sr-only'
                  : 'block w-full resize-none overflow-hidden bg-transparent text-sm leading-relaxed outline-none placeholder:text-muted'
              }
            />
            {showRendered && (
              <div
                onClick={(e) => {
                  if (editable && !(e.target as HTMLElement).closest('a')) descRef.current?.focus()
                }}
                className={cn('min-w-0 [overflow-wrap:anywhere]', editable && 'cursor-text')}
              >
                <Markdown source={description} />
              </div>
            )}
            {bug.transcript !== null && (
              <div className="mt-4 rounded-lg border border-border bg-bg-subtle px-3 py-2.5 text-xs text-muted">
                <p className="mb-1 flex items-center gap-1.5 font-medium text-fg">
                  <Mic className="h-3.5 w-3.5 text-muted" aria-hidden="true" />
                  Voice transcript
                </p>
                <p className="leading-relaxed [overflow-wrap:anywhere] whitespace-pre-wrap">
                  {bug.transcript}
                </p>
              </div>
            )}
          </section>

          {gallery.length > 0 && (
            <section className="min-w-0">
              <h2 className={SECTION_HEADING}>
                Attachments <span className="ml-1 tabular-nums">{gallery.length}</span>
              </h2>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {bug.attachments.map((a, i) => (
                  <AttachmentThumb
                    key={a.id}
                    attachment={a}
                    caption={`Screenshot ${i + 1}`}
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

          <CommentThread bugId={bug.optimistic ? null : bug.id} members={members} selfId={selfId} />
        </div>

        {lightboxIndex >= 0 && (
          <Lightbox
            urls={viewable.map((g) => g.url)}
            index={lightboxIndex}
            onClose={() => setLightboxKey(null)}
            onIndex={(i) => setLightboxKey(viewable[i]?.key ?? null)}
          />
        )}
      </div>
    </div>
  )
}

const SECTION_HEADING = 'mb-3 text-xs font-medium tracking-wide text-muted uppercase'

function DeleteDialog({
  bug,
  onCancel,
  onDelete,
}: {
  bug: BugWithMeta
  onCancel: () => void
  onDelete: () => Promise<void>
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  useOverlayOpen(true)
  const noun = KIND_LABEL[bug.kind].one.toLowerCase()

  function destroy() {
    setBusy(true)
    setError(null)
    // On success the bug leaves the list and this dialog unmounts with it.
    onDelete().catch((err: unknown) => {
      setBusy(false)
      setError(err instanceof Error ? err.message : 'Something went wrong.')
    })
  }

  return (
    <dialog
      ref={(node) => {
        if (node && !node.open) node.showModal()
      }}
      onCancel={(event) => {
        event.preventDefault()
        if (!busy) onCancel()
      }}
      aria-labelledby="delete-bug-title"
      className="m-auto w-[calc(100%-2rem)] max-w-md rounded-lg border border-border bg-bg-elevated p-6 text-fg shadow-elevated backdrop:bg-black/50"
    >
      <form
        onSubmit={(event) => {
          event.preventDefault()
          destroy()
        }}
        className="space-y-4 text-sm"
      >
        <h3 id="delete-bug-title" className="text-base font-semibold">
          Delete {noun} #{bug.number}?
        </h3>
        <p className="text-muted">
          “{bug.title}” and its screenshots, comments and activity will be permanently removed. This
          cannot be undone. To keep a record, resolve it instead.
        </p>
        {error && (
          <p role="alert" className="text-danger">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={onCancel}
            className={buttonClass('secondary')}
          >
            Cancel
          </button>
          <button autoFocus disabled={busy} className={buttonClass('danger')}>
            {busy ? 'Deleting…' : `Delete ${noun}`}
          </button>
        </div>
      </form>
    </dialog>
  )
}

const THUMB_CLASS =
  't focus-ring group relative block aspect-video w-full overflow-hidden rounded-lg border border-border bg-bg-subtle hover:-translate-y-0.5 hover:border-fg/20 hover:shadow-elevated'

function AttachmentThumb({
  attachment,
  caption,
  label,
  onSigned,
  onOpen,
}: {
  attachment: BugAttachment
  caption: string
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
      className={cn(
        THUMB_CLASS,
        'cursor-zoom-in disabled:cursor-default disabled:hover:translate-y-0 disabled:hover:shadow-none',
      )}
    >
      {url ? (
        <>
          <img src={url} alt="" className="h-full w-full object-cover" />
          <span
            aria-hidden="true"
            className="t absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 bg-black/60 px-2 py-1 text-[11px] font-medium text-white opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100"
          >
            <span className="truncate">{caption}</span>
            {attachment.width > 0 && attachment.height > 0 && (
              <span className="shrink-0 text-white/70 tabular-nums">
                {attachment.width}×{attachment.height}
              </span>
            )}
          </span>
        </>
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
    <div className="relative min-w-0">
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
          <span className="absolute right-1.5 bottom-1.5 left-1.5 rounded-md bg-danger px-1.5 py-0.5 text-center text-xs font-medium text-white">
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
          className="t focus-ring absolute top-1.5 right-1.5 inline-flex items-center gap-1 rounded-md bg-black/70 px-1.5 py-0.5 text-xs font-medium text-white hover:bg-black/85"
        >
          <RotateCw size={10} aria-hidden="true" />
          Retry
        </button>
      )}
    </div>
  )
}
