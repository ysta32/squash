import { formatContext, sanitizeContext } from '../lib/bugContext'
import { Fragment, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import {
  AlertCircle,
  ArrowLeft,
  ArrowRightLeft,
  Check,
  Copy,
  Ellipsis,
  Mic,
  MousePointerClick,
  RotateCcw,
  RotateCw,
  Trash2,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { KeyboardEvent as ReactKeyboardEvent, ReactNode } from 'react'
import { useDismiss } from '../hooks/useDismiss'
import { useFixRuns } from '../hooks/useFixRuns'
import { useOverlayOpen } from '../hooks/useKeyboard'
import { useSignedUrl } from '../hooks/useSignedUrl'
import type { ClaudeRun } from '../lib/claudeExport'
import { shortSha } from '../lib/fixRuns'
import type {
  Bug,
  BugAttachment,
  BugWithMeta,
  PendingUpload,
  Severity,
  WorkspaceMember,
} from '../lib/types'
import { KIND_LABEL, SEVERITY_LABEL } from '../lib/types'
import { Markdown } from '../lib/markdown'
import { cn, relativeTime } from '../lib/utils'
import { AssigneePicker } from './AssigneePicker'
import { SeverityPicker } from './SeverityPicker'
import { ClaudeProgress, SparkMark, StatusGlyph } from './ClaudeProgress'
import { CommentThread } from './CommentThread'
import { FixRecord } from './FixRecord'
import { Lightbox, type LightboxMarkup } from './Lightbox'
import { AnnotationChecklist } from './AnnotationChecklist'
import { AnnotationOverlay } from './AnnotationOverlay'
import { pinChecklist, parseAnnotations } from '../lib/annotations'
import { ResolvePopover } from './ResolvePopover'
import { Kbd, buttonClass, menuItemClass } from './ui'

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
      <div className="relative hidden h-full overflow-hidden md:block">
        <div aria-hidden="true" className={RULED_PAPER} />
        <div className="relative max-w-[760px] px-[32px] pt-16">
          <MousePointerClick
            size={20}
            strokeWidth={1.5}
            absoluteStrokeWidth
            className="text-ink-3"
            aria-hidden="true"
          />
          <p className="mt-4 text-base font-medium text-ink">Select a bug to see its details</p>
          <p className="mt-1 flex flex-wrap items-center gap-1 text-sm text-ink-2">
            <Kbd>J</Kbd>
            <Kbd>K</Kbd>
            <span className="mr-2">to move</span>
            <Kbd>N</Kbd>
            <span>to file one</span>
          </p>
        </div>
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
  /** Lightbox caption detail: `W×H · file name`. */
  caption: string | null
  /** Live markup layers over an uploaded screenshot (pending ones are already flattened). */
  markup: LightboxMarkup | null
}

function attachmentCaption(a: BugAttachment): string {
  const name = a.storage_path.split('/').pop() ?? ''
  const size = a.width > 0 && a.height > 0 ? `${a.width}×${a.height}` : ''
  return [size, name].filter(Boolean).join(' · ')
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
  /** The last action that failed, so the inline error can offer Retry. */
  const [failed, setFailed] = useState<{
    action: () => void | Promise<void>
    onSuccess?: () => void
  } | null>(null)
  const stampRef = useRef<HTMLSpanElement>(null)
  const barRef = useRef<HTMLDivElement>(null)
  const prevStatus = useRef(bug.status)
  const [signed, setSigned] = useState<Record<string, string>>({})
  const [lightboxKey, setLightboxKey] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const descRef = useRef<HTMLTextAreaElement>(null)
  /** Set by Esc so the blur that follows discards the draft instead of saving it. */
  const cancelRef = useRef(false)
  const fix = useFixRuns(bug.optimistic ? null : bug.id)
  /** Screenshots a fix run attached as its "after", labeled with that run (newest run wins). */
  const afterOf = new Map<string, string>()
  for (const r of fix.runs) {
    if (r.after_attachment_id && !afterOf.has(r.after_attachment_id)) {
      afterOf.set(r.after_attachment_id, r.commit_sha ? `fix ${shortSha(r.commit_sha)}` : 'fix run')
    }
  }

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

  // While the action cluster is the fixed bottom bar (phones), publish its height (safe-area
  // inset included) as --bottom-bar-h so toasts and other bottom-anchored UI sit above it.
  useLayoutEffect(() => {
    const el = barRef.current
    const root = document.documentElement
    if (!el) return
    const sync = () => {
      if (getComputedStyle(el).position === 'fixed') {
        root.style.setProperty('--bottom-bar-h', `${el.getBoundingClientRect().height}px`)
      } else {
        root.style.removeProperty('--bottom-bar-h')
      }
    }
    sync()
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(sync)
    observer?.observe(el)
    window.addEventListener('resize', sync)
    return () => {
      observer?.disconnect()
      window.removeEventListener('resize', sync)
      root.style.removeProperty('--bottom-bar-h')
    }
  }, [])

  // The resolve moment (DESIGN.md section 8): when this bug goes open → resolved while shown,
  // the check pin stamps in (scale 1.15 → 1) as the title settles to text-2. The strikethrough
  // belongs to list rows only. Reduced motion, or an already resolved bug, shows the end state.
  useLayoutEffect(() => {
    const was = prevStatus.current
    prevStatus.current = bug.status
    if (was !== 'open' || bug.status !== 'resolved') return
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches) return
    const easing = 'cubic-bezier(0.2, 0.8, 0.2, 1)'
    stampRef.current?.animate?.(
      [
        { transform: 'scale(1.15)', opacity: 0 },
        { transform: 'scale(1)', opacity: 1 },
      ],
      { duration: 220, easing, fill: 'backwards' },
    )
  }, [bug.status])

  function run(action: () => void | Promise<void>, onSuccess?: () => void) {
    setError(null)
    setFailed(null)
    Promise.resolve()
      .then(action)
      .then(onSuccess, (err: unknown) => {
        const msg =
          err instanceof Error ? err.message : 'Could not save changes. Check your connection.'
        setError(msg)
        setFailed({ action, onSuccess })
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
  const popoverOpen = popover !== null && editable

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
    ...bug.attachments.map((a) => ({
      key: a.id,
      url: signed[a.storage_path] ?? null,
      caption: [afterOf.has(a.id) ? `After ${afterOf.get(a.id)}` : '', attachmentCaption(a)]
        .filter(Boolean)
        .join(' · '),
      markup: a.annotations
        ? { annotations: a.annotations, width: a.width, height: a.height }
        : null,
    })),
    ...pending.map((p) => ({
      key: p.localId,
      url: p.previewUrl,
      caption: p.error ? 'Upload failed' : 'Uploading',
      markup: null,
    })),
  ]
  // Screenshots with numbered pins, by figure number: each gets a checklist under the gallery.
  const pinned = bug.attachments
    .map((a, i) => ({ attachment: a, figure: i + 1 }))
    .filter(({ attachment }) => pinChecklist(parseAnnotations(attachment.annotations)).length > 0)
  const viewable = gallery.filter((g): g is GalleryItem & { url: string } => g.url !== null)
  const lightboxIndex = lightboxKey ? viewable.findIndex((g) => g.key === lightboxKey) : -1

  const title = titleDraft ?? bug.title
  const noun = KIND_LABEL[bug.kind].one.toLowerCase()
  const menuItems: MenuItem[] = [
    ...(onCopy
      ? [
          {
            key: 'copy',
            label: 'Copy prompt for Claude Code',
            icon: <MenuIcon icon={Copy} />,
            onSelect: () => onCopy(bug),
            disabled: !editable,
          },
        ]
      : []),
    {
      key: 'kind',
      label: `Move to ${KIND_LABEL[otherKind].many}`,
      icon: <MenuIcon icon={ArrowRightLeft} />,
      onSelect: () => run(() => onUpdate(bug.id, { kind: otherKind })),
      disabled: !editable,
    },
    ...(onDelete && canDelete
      ? [
          {
            key: 'delete',
            label: `Delete ${noun}`,
            icon: <MenuIcon icon={Trash2} />,
            onSelect: () => setConfirmDelete(true),
            disabled: !editable,
            danger: true,
          },
        ]
      : []),
  ]

  return (
    <div className="@container h-full min-w-0 overflow-y-auto [scrollbar-gutter:stable]">
      <article
        aria-label={`${KIND_LABEL[bug.kind].one} ${bug.optimistic ? '' : `#${bug.number}`}`.trim()}
        className="w-full max-w-[808px] min-w-0 px-[16px] pt-4 pb-32 @xl:px-[48px] @xl:pt-8 sm:pb-16"
      >
        <header className="border-b border-line pb-6">
          <button
            type="button"
            onClick={onBack}
            title="Back (Esc)"
            className="t focus-ring -mt-2 mb-2 -ml-3 inline-flex h-11 items-center gap-1.5 rounded-md px-3 text-sm font-medium text-ink-2 hover:bg-surface-3 hover:text-ink lg:hidden"
          >
            <ArrowLeft size={16} strokeWidth={1.5} absoluteStrokeWidth aria-hidden="true" />
            Back
          </button>
          <SpecimenLabel bug={bug} filer={filer?.display_name ?? 'Deleted user'} />

          <div className="relative mt-5">
            <textarea
              ref={titleRef}
              rows={1}
              value={title}
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
              className={cn(
                TITLE_TYPE,
                't focus-ring block w-full resize-none overflow-hidden rounded-md bg-transparent',
                editable && 'hover:bg-surface-3/60 focus:bg-surface-2',
                isOpen ? 'text-ink' : 'text-ink-2',
              )}
            />
          </div>

          {!isOpen && (
            <div className="mt-3 flex items-start gap-2 text-sm text-ink-2">
              <span ref={stampRef} className="mt-0.5 inline-flex text-status-resolved">
                <StatusGlyph kind="done" />
              </span>
              <div className="min-w-0">
                <p>
                  Resolved by{' '}
                  <span className="font-medium text-ink">
                    {resolver?.display_name ?? 'Deleted user'}
                  </span>
                  {bug.resolved_at && (
                    <>
                      {' · '}
                      <time
                        dateTime={bug.resolved_at}
                        title={new Date(bug.resolved_at).toLocaleString()}
                        className="font-mono text-xs text-ink-3"
                      >
                        {relativeTime(bug.resolved_at)}
                      </time>
                    </>
                  )}
                </p>
                {bug.resolution_note && (
                  <blockquote className="mt-1 max-w-[68ch] [overflow-wrap:anywhere] whitespace-pre-wrap text-ink">
                    “{bug.resolution_note}”
                  </blockquote>
                )}
              </div>
            </div>
          )}

          <div className="mt-4 flex flex-wrap items-center gap-x-1 gap-y-2">
            <div className="-ml-2 flex min-w-0 flex-wrap items-center gap-1">
              <SeverityPicker
                value={bug.severity}
                onChange={setSeverity}
                size="quiet"
                align="start"
                disabled={!editable}
              />
              <span aria-hidden="true" className="h-4 w-px bg-line" />
              <AssigneePicker
                members={members}
                value={bug.assignee_id}
                selfId={selfId}
                variant="toolbar"
                align="start"
                disabled={!editable || !onAssign}
                openRequest={assignRequest}
                onChange={(userId) => {
                  if (onAssign) run(() => onAssign(bug.id, userId))
                }}
              />
            </div>

            {/* One action cluster: inline at the end of the toolbar (its own row when the pane is
                narrow), and a bottom action bar on phones: [Resolve, wide][spark][…]. */}
            <div
              ref={barRef}
              className="relative ml-auto flex items-center gap-2 @max-2xl:ml-0 @max-2xl:w-full max-sm:fixed max-sm:inset-x-0 max-sm:bottom-0 max-sm:z-20 max-sm:border-t max-sm:border-line max-sm:bg-surface-2 max-sm:px-4 max-sm:pt-3 max-sm:pb-[max(0.75rem,env(safe-area-inset-bottom))] max-sm:shadow-elev-2"
            >
              {onSend && (
                <button
                  type="button"
                  disabled={!editable}
                  onClick={() => onSend(bug)}
                  title="Open Claude Code on this bug (C)"
                  className={buttonClass(
                    'secondary',
                    'md',
                    'h-8 px-3 max-sm:order-2 max-sm:h-11 max-sm:w-11 max-sm:px-0',
                  )}
                >
                  <SparkMark className="text-accent" />
                  <span className="max-sm:sr-only">Send to Claude Code</span>
                </button>
              )}
              {/* The popover hangs from the cluster's end edge (desktop) or replaces the bar
                  as a sheet (phones); while it is open its own Resolve is the filled one, so the
                  trigger reads as pressed. */}
              <div className="max-sm:order-1 max-sm:flex-1">
                <button
                  type="button"
                  disabled={!editable}
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={() => onPopover(popover ? null : isOpen ? 'resolve' : 'reopen')}
                  title={isOpen ? 'Resolve (R)' : 'Reopen'}
                  aria-expanded={popoverOpen}
                  className={buttonClass(
                    isOpen && !popoverOpen ? 'primary' : 'secondary',
                    'md',
                    cn(
                      'h-8 px-3.5 max-sm:h-11 max-sm:w-full',
                      popoverOpen && 'border-line-input! bg-surface-3!',
                    ),
                  )}
                >
                  {isOpen ? (
                    <Check size={16} strokeWidth={1.5} absoluteStrokeWidth aria-hidden="true" />
                  ) : (
                    <RotateCcw size={16} strokeWidth={1.5} absoluteStrokeWidth aria-hidden="true" />
                  )}
                  {isOpen ? 'Resolve' : 'Reopen'}
                </button>
                <ResolvePopover
                  mode={isOpen ? 'resolve' : 'reopen'}
                  open={popoverOpen}
                  onClose={() => onPopover(null)}
                  onConfirm={confirmPopover}
                  placement="responsive"
                />
              </div>
              <div className="max-sm:order-3">
                <MoreMenu items={menuItems} />
              </div>
            </div>
          </div>

          {error && (
            <div
              role="alert"
              className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-danger"
            >
              <AlertCircle size={16} strokeWidth={1.5} absoluteStrokeWidth aria-hidden="true" />
              <span className="min-w-0 [overflow-wrap:anywhere]">{error}</span>
              {failed && (
                <button
                  type="button"
                  onClick={() => run(failed.action, failed.onSuccess)}
                  className="t focus-ring rounded-sm font-medium text-ink underline decoration-line-input underline-offset-2 hover:decoration-ink"
                >
                  Retry
                </button>
              )}
            </div>
          )}
        </header>
        {onDelete && canDelete && confirmDelete && (
          <DeleteDialog
            bug={bug}
            onCancel={() => setConfirmDelete(false)}
            onDelete={() => onDelete(bug.id)}
          />
        )}

        <div className="mt-8 space-y-12">
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
                  : 't focus-ring -mx-2 block w-full max-w-[calc(68ch+1rem)] resize-none overflow-hidden rounded-md bg-transparent px-2 text-read text-ink placeholder:text-ink-3 hover:bg-surface-3/60 focus:bg-surface-2'
              }
            />
            {showRendered && (
              <div
                onClick={(e) => {
                  if (editable && !(e.target as HTMLElement).closest('a')) descRef.current?.focus()
                }}
                className={cn(READ_TEXT, editable && 'cursor-text')}
              >
                <Markdown source={description} className="[overflow-wrap:anywhere]" />
              </div>
            )}
            {bug.transcript !== null && (
              <figure className="mt-6 max-w-[68ch] border-l-2 border-line-2 pl-4">
                <figcaption className="specimen-label flex items-center gap-1.5 text-ink-3">
                  <Mic size={14} strokeWidth={1.5} absoluteStrokeWidth aria-hidden="true" />
                  Voice transcript
                </figcaption>
                <p className="mt-2 text-sm [overflow-wrap:anywhere] whitespace-pre-wrap text-ink-2">
                  {bug.transcript}
                </p>
              </figure>
            )}
          </section>

          {gallery.length > 0 && (
            <section aria-labelledby={`shots-${bug.id}`} className="min-w-0">
              <h2 id={`shots-${bug.id}`} className={SECTION_HEADING}>
                Screenshots <span className="nums text-ink-3">{gallery.length}</span>
              </h2>
              <ul className="grid grid-cols-2 gap-x-4 gap-y-5 @2xl:grid-cols-3">
                {bug.attachments.map((a, i) => (
                  <AttachmentThumb
                    key={a.id}
                    attachment={a}
                    figure={i + 1}
                    after={afterOf.get(a.id)}
                    label={`Open screenshot ${i + 1}${afterOf.has(a.id) ? `, after ${afterOf.get(a.id)}` : ''}`}
                    onSigned={onSigned}
                    onOpen={() => setLightboxKey(a.id)}
                  />
                ))}
                {pending.map((p, i) => (
                  <PendingThumb
                    key={p.localId}
                    upload={p}
                    figure={bug.attachments.length + i + 1}
                    label={`Open screenshot ${bug.attachments.length + i + 1}`}
                    onOpen={() => setLightboxKey(p.localId)}
                    onRetry={onRetryUploads}
                  />
                ))}
              </ul>
              {pinned.length > 0 && (
                <div className="mt-5 flex flex-col gap-4">
                  {pinned.map(({ attachment, figure }) => (
                    <figure key={attachment.id} className="min-w-0">
                      <figcaption className="specimen-label mb-2 text-ink-3">
                        Fig. {figure} · Pins
                      </figcaption>
                      <AnnotationChecklist annotations={attachment.annotations} />
                    </figure>
                  ))}
                </div>
              )}
            </section>
          )}

          {claudeRun && <ClaudeProgress run={claudeRun} />}

          <FixRecord bugId={bug.id} fix={fix} attachments={bug.attachments} />

          <CommentThread
            bugId={bug.optimistic ? null : bug.id}
            members={members}
            selfId={selfId}
            headerNote={isOpen ? null : bug.resolution_note}
          />
        </div>

        {lightboxIndex >= 0 && (
          <Lightbox
            urls={viewable.map((g) => g.url)}
            captions={viewable.map((g) => g.caption)}
            markup={viewable.map((g) => g.markup)}
            index={lightboxIndex}
            onClose={() => setLightboxKey(null)}
            onIndex={(i) => setLightboxKey(viewable[i]?.key ?? null)}
          />
        )}
      </article>
    </div>
  )
}

const TITLE_TYPE =
  '-mx-2 px-2 py-0.5 text-xl font-semibold break-words whitespace-pre-wrap [width:calc(100%+1rem)] [transition-property:color,background-color] duration-(--dur-emphasis)'
const SECTION_HEADING = 'specimen-label mb-3 text-ink-3'
const READ_TEXT =
  'max-w-[68ch] min-w-0 text-ink [&>div]:text-read [&>div]:leading-[1.7143rem] [&>div]:space-y-3'
/** Faint ruled-paper lines (1px every 24px) fading out to the bottom right. */
const RULED_PAPER =
  'absolute inset-0 bg-[repeating-linear-gradient(to_bottom,transparent_0,transparent_23px,var(--border-1)_23px,var(--border-1)_24px)] [mask-image:linear-gradient(160deg,black_10%,transparent_65%)] opacity-70'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** `07 Oct 2026 14:02` in local time (shown uppercase in the specimen label). */
function labelDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(d.getDate())} ${MONTHS[d.getMonth()]} ${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

const SEVERITY_TEXT = {
  low: 'text-sev-low',
  medium: 'text-sev-medium',
  high: 'text-sev-high',
  critical: 'text-sev-critical',
} as const

/**
 * The specimen label (DESIGN.md section 3): accession number, kind, severity and status on the
 * top line; collector, date and the captured page context under a hairline.
 */
function SpecimenLabel({ bug, filer }: { bug: BugWithMeta; filer: string }) {
  const context = sanitizeContext(bug.context)
  const environment = formatContext({ ...context, url: undefined })
  const hasContext = formatContext(context) !== ''
  const url = context.url ? splitTail(context.url.replace(/^https?:\/\//, '')) : null
  const number = bug.optimistic ? '…' : String(bug.number).padStart(3, '0')
  const sep = (
    <span aria-hidden="true" className="text-ink-3">
      {' · '}
    </span>
  )

  return (
    <div className="specimen-label w-fit max-w-full min-w-0 rounded-xs border border-line-2 bg-surface-1 text-ink-2">
      <p className="border-b border-line px-3 py-1.5">
        <span className="font-medium text-ink">No. {number}</span>
        {sep}
        {KIND_LABEL[bug.kind].one}
        {sep}
        <span className={SEVERITY_TEXT[bug.severity]}>{SEVERITY_LABEL[bug.severity]}</span>
        {bug.status === 'resolved' && (
          <>
            {sep}
            <span className="text-status-resolved">Resolved</span>
          </>
        )}
      </p>
      <div className="px-3 py-1.5">
        <p className="[overflow-wrap:anywhere]">
          <abbr title="Collected by" className="no-underline">
            Coll.
          </abbr>{' '}
          {filer}
          {sep}
          <time dateTime={bug.created_at} title={new Date(bug.created_at).toLocaleString()}>
            {labelDate(bug.created_at)}
          </time>
        </p>
        {/* The captured context gets its own line and never wraps the label. Where the label is
            narrow the URL and the environment each take a line; a long URL gives way in the
            middle, so its end (the page and query) stays readable. */}
        {hasContext && (
          <div
            role="group"
            aria-label="Bug context"
            title={formatContext(context)}
            className="-m-[4px] flex min-w-0 flex-col p-[4px] normal-case @xl:flex-row @xl:items-baseline"
          >
            {url && (
              <a
                href={context.url}
                target="_blank"
                rel="noopener noreferrer"
                className="focus-ring flex max-w-full min-w-0 rounded-xs text-ink underline decoration-line-input underline-offset-2 hover:decoration-ink"
              >
                <span className="truncate">{url[0]}</span>
                <span className="shrink-0 whitespace-pre">{url[1]}</span>
              </a>
            )}
            {url && environment && (
              <span
                aria-hidden="true"
                className="hidden shrink-0 whitespace-pre text-ink-3 @xl:inline"
              >
                {' · '}
              </span>
            )}
            {environment && (
              <span className="max-w-full min-w-0 truncate @xl:shrink-0">{environment}</span>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

/**
 * Splits a URL into a head that may be cut with an ellipsis and a tail kept whole: the query or
 * last path segment when it is short, otherwise the last 12 characters.
 */
function splitTail(text: string): [string, string] {
  const cut = Math.max(text.lastIndexOf('/'), text.lastIndexOf('?'))
  const at = cut > 0 && text.length - cut <= 24 ? cut : Math.max(0, text.length - 12)
  return [text.slice(0, at), text.slice(at)]
}

interface MenuItem {
  key: string
  label: string
  icon: ReactNode
  onSelect: () => void
  disabled?: boolean
  danger?: boolean
  className?: string
}

/** The `…` menu: secondary actions (copy, move, delete) kept out of the toolbar. */
function MoreMenu({ items }: { items: MenuItem[] }) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const close = useCallback(() => setOpen(false), [])
  useDismiss(rootRef, close, open)

  /** Enabled items, minus any hidden by a container query (e.g. Send when it has a button). */
  const focusable = useCallback((): HTMLButtonElement[] => {
    const all = Array.from(
      menuRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not(:disabled)') ??
        [],
    )
    const shown = all.filter((el) => el.getClientRects().length > 0)
    return shown.length > 0 ? shown : all
  }, [])

  useEffect(() => {
    if (open) focusable()[0]?.focus()
  }, [open, focusable])

  function onKeyDown(e: ReactKeyboardEvent<HTMLDivElement>) {
    const all = focusable()
    const at = all.indexOf(document.activeElement as HTMLButtonElement)
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      if (all.length === 0) return
      const next = (at + (e.key === 'ArrowDown' ? 1 : -1) + all.length) % all.length
      all[next]?.focus()
    } else if (e.key === 'Home' || e.key === 'End') {
      e.preventDefault()
      all[e.key === 'Home' ? 0 : all.length - 1]?.focus()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      e.stopPropagation()
      setOpen(false)
      triggerRef.current?.focus()
    } else if (e.key === 'Tab') {
      setOpen(false)
    }
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        aria-label="More actions"
        aria-haspopup="menu"
        aria-expanded={open}
        title="More actions"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          't focus-ring inline-flex h-8 w-8 items-center justify-center rounded-md text-ink-2 hover:bg-surface-3 hover:text-ink max-sm:h-11 max-sm:w-11 max-sm:border max-sm:border-line-2',
          open && 'bg-surface-3 text-ink',
        )}
      >
        <Ellipsis size={16} strokeWidth={1.5} absoluteStrokeWidth aria-hidden="true" />
      </button>
      {open && (
        <div
          ref={menuRef}
          role="menu"
          aria-label="More actions"
          onKeyDown={onKeyDown}
          className="panel absolute right-0 bottom-full z-30 mb-2 w-64 animate-in p-1 sm:top-full sm:bottom-auto sm:mt-1 sm:mb-0"
        >
          {items.map((item, i) => (
            <Fragment key={item.key}>
              {/* A hairline sets the destructive action apart from the rest. */}
              {item.danger && i > 0 && <div role="separator" className="-mx-1 my-1 h-px bg-line" />}
              <button
                type="button"
                role="menuitem"
                disabled={item.disabled}
                onClick={() => {
                  setOpen(false)
                  triggerRef.current?.focus()
                  item.onSelect()
                }}
                className={cn(
                  menuItemClass,
                  'focus-ring-inset pointer-coarse:h-11',
                  // `!`: menuItemClass sets text-ink, which would otherwise win on source order.
                  item.danger && !item.disabled && 'text-danger! [&>svg]:text-danger!',
                  item.className,
                )}
              >
                {item.icon}
                {item.label}
              </button>
            </Fragment>
          ))}
        </div>
      )}
    </div>
  )
}

function MenuIcon({ icon: Icon }: { icon: LucideIcon }) {
  return <Icon size={16} strokeWidth={1.5} absoluteStrokeWidth aria-hidden="true" />
}

/** Static placeholder that matches the detail layout: label, title, toolbar, description, shots. */
export function BugDetailSkeleton() {
  const block = 'animate-skeleton bg-surface-3'
  return (
    <div role="status" aria-label="Loading bug" className="@container h-full min-w-0">
      <span className="sr-only">Loading…</span>
      <div className="w-full max-w-[760px] px-[16px] pt-4 @xl:px-[32px] @xl:pt-8 @min-[1200px]:mx-auto">
        <div className="border-b border-line pb-6">
          <div className="w-72 max-w-full rounded-xs border border-line-2 bg-surface-1">
            <div className="border-b border-line px-3 py-[9px]">
              <div className={cn(block, 'h-[10px] w-40 rounded-xs')} />
            </div>
            <div className="px-3 py-[9px]">
              <div className={cn(block, 'h-[10px] w-56 max-w-full rounded-xs')} />
            </div>
          </div>
          <div className={cn(block, 'mt-6 h-6 w-3/4 rounded-sm')} />
          <div className="mt-5 flex items-center gap-3">
            <div className={cn(block, 'h-6 w-24 rounded-md')} />
            <div className={cn(block, 'h-6 w-28 rounded-md')} />
            <div className={cn(block, 'ml-auto h-8 w-24 rounded-md max-sm:hidden')} />
          </div>
        </div>
        <div className="mt-8 max-w-[68ch] space-y-3">
          <div className={cn(block, 'mb-5 h-[10px] w-24 rounded-xs')} />
          <div className={cn(block, 'h-4 w-full rounded-sm')} />
          <div className={cn(block, 'h-4 w-11/12 rounded-sm')} />
          <div className={cn(block, 'h-4 w-2/3 rounded-sm')} />
        </div>
        <div className="mt-12">
          <div className={cn(block, 'mb-4 h-[10px] w-28 rounded-xs')} />
          <div className="grid grid-cols-2 gap-4 @2xl:grid-cols-3">
            <div className={cn(block, 'aspect-[4/3] rounded-lg')} />
            <div className={cn(block, 'aspect-[4/3] rounded-lg')} />
          </div>
        </div>
      </div>
    </div>
  )
}

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
      className="m-auto w-[calc(100%-2rem)] max-w-md animate-dialog rounded-xl border border-line bg-surface-2 p-6 text-ink shadow-elev-3 backdrop:bg-scrim"
    >
      <form
        onSubmit={(event) => {
          event.preventDefault()
          destroy()
        }}
        className="space-y-4 text-sm"
      >
        <h3 id="delete-bug-title" className="text-lg font-semibold">
          Delete {noun} #{bug.number}?
        </h3>
        <p className="text-ink-2">
          <span className="text-ink">“{bug.title}”</span> and its screenshots, comments and activity
          will be removed for everyone in the workspace.
        </p>
        <p className="text-ink-2">
          <span className="font-medium text-danger">This cannot be undone.</span> To keep a record,
          resolve it instead.
        </p>
        {error && (
          <p role="alert" className="text-danger">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <button
            type="button"
            // The safe choice holds focus, so a stray Enter never deletes.
            autoFocus
            disabled={busy}
            onClick={onCancel}
            className={buttonClass('secondary')}
          >
            Cancel
          </button>
          <button
            disabled={busy}
            className={buttonClass(
              'danger',
              'md',
              'border-danger bg-danger text-bg hover:bg-danger hover:opacity-90',
            )}
          >
            {busy ? 'Deleting…' : `Delete ${noun}`}
          </button>
        </div>
      </form>
    </dialog>
  )
}

/** A screenshot laid on paper: 4:3, 8px radius, specimen-drawer shadow and a 1px inner edge. */
const THUMB_CLASS =
  't focus-ring group relative block aspect-[4/3] w-full overflow-hidden rounded-lg bg-surface-3 shadow-elev-3 after:pointer-events-none after:absolute after:inset-0 after:rounded-[inherit] after:shadow-[inset_0_0_0_1px_var(--border-1)] hover:-translate-y-0.5'

function FigureCaption({
  figure,
  size,
  after,
}: {
  figure: number
  size?: string
  /** Set on a fix run's "after" screenshot: the run it proves, e.g. "fix e3f9a12". */
  after?: string
}) {
  return (
    <figcaption className="specimen-label mt-2 flex items-start justify-between gap-2 text-ink-3">
      {/* Up to two lines: a narrow thumbnail would otherwise cut an "After fix …" label. */}
      <span
        title={after ? `After ${after}` : undefined}
        className="line-clamp-2 min-w-0 [overflow-wrap:anywhere]"
      >
        Fig. {figure}
        {after && (
          <>
            {' · '}
            <span className="text-status-resolved">After</span>{' '}
            <span className="normal-case whitespace-nowrap">{after}</span>
          </>
        )}
      </span>
      {/* An "after" label needs the room more than the size, which the viewer still shows. */}
      {size && !after && <span className="shrink-0">{size}</span>}
    </figcaption>
  )
}

function AttachmentThumb({
  attachment,
  figure,
  after,
  label,
  onSigned,
  onOpen,
}: {
  attachment: BugAttachment
  figure: number
  after?: string
  label: string
  onSigned: (path: string, url: string | null) => void
  onOpen: () => void
}) {
  const url = useSignedUrl(attachment.storage_path)
  useLayoutEffect(() => {
    onSigned(attachment.storage_path, url)
  }, [attachment.storage_path, url, onSigned])

  return (
    <li className="min-w-0">
      <figure>
        <button
          type="button"
          aria-label={label}
          disabled={!url}
          onClick={onOpen}
          className={cn(
            THUMB_CLASS,
            'cursor-zoom-in disabled:cursor-default disabled:hover:translate-y-0',
          )}
        >
          {url ? (
            <>
              <img src={url} alt="" className="h-full w-full object-cover object-left-top" />
              <AnnotationOverlay
                annotations={attachment.annotations}
                width={attachment.width}
                height={attachment.height}
                fit="cover"
                align="top-left"
                pinSize={0.04}
              />
            </>
          ) : (
            <span className="absolute inset-0 animate-skeleton bg-surface-3" />
          )}
        </button>
        <FigureCaption
          figure={figure}
          after={after}
          size={
            attachment.width > 0 && attachment.height > 0
              ? `${attachment.width}×${attachment.height}`
              : undefined
          }
        />
      </figure>
    </li>
  )
}

function PendingThumb({
  upload,
  figure,
  label,
  onOpen,
  onRetry,
}: {
  upload: PendingUpload
  figure: number
  label: string
  onOpen: () => void
  onRetry?: () => void
}) {
  const uploading = !upload.error && upload.progress < 1
  const r = 9
  const circumference = 2 * Math.PI * r
  const shown = Math.max(0.25, Math.min(1, upload.progress))

  return (
    <li className="relative min-w-0">
      <figure>
        <button
          type="button"
          aria-label={label}
          onClick={onOpen}
          className={cn(THUMB_CLASS, 'cursor-zoom-in')}
        >
          <img
            src={upload.previewUrl}
            alt=""
            className={cn('h-full w-full object-cover object-left-top', uploading && 'opacity-60')}
          />
          {uploading && (
            <span className="absolute inset-0 flex items-center justify-center text-accent">
              <svg
                viewBox="0 0 24 24"
                className="h-6 w-6 animate-spin rounded-full bg-surface-2 shadow-elev-2"
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
                  stroke="currentColor"
                  strokeOpacity="0.25"
                  strokeWidth="2"
                />
                <circle
                  cx="12"
                  cy="12"
                  r={r}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeDasharray={`${shown * circumference} ${circumference}`}
                  transform="rotate(-90 12 12)"
                />
              </svg>
            </span>
          )}
          {upload.error && (
            <span className="absolute right-2 bottom-2 left-2 rounded-md bg-surface-2 px-2 py-1 text-left text-xs font-medium text-danger shadow-elev-2">
              Upload failed
            </span>
          )}
        </button>
        <FigureCaption figure={figure} />
      </figure>
      {upload.error && onRetry && (
        <button
          type="button"
          aria-label="Retry upload"
          title="Retry upload"
          onClick={onRetry}
          className="t focus-ring absolute top-2 right-2 inline-flex h-7 items-center gap-1 rounded-md bg-surface-2 px-2 text-xs font-medium text-ink shadow-elev-2 hover:text-accent pointer-coarse:h-11"
        >
          <RotateCw size={14} strokeWidth={1.5} absoluteStrokeWidth aria-hidden="true" />
          Retry
        </button>
      )}
    </li>
  )
}
