import { memo, useEffect, useRef } from 'react'
import { Check, CircleCheck, Eye, Image as ImageIcon, Sparkle, SquareCheck } from 'lucide-react'
import type { PresenceUser } from '../hooks/usePresence'
import type { ClaudeRunState } from '../lib/claudeExport'
import type { BugWithMeta, WorkspaceMember } from '../lib/types'
import { cn, relativeTime } from '../lib/utils'
import { Avatar } from './Avatar'
import { SeverityTicks } from './SeverityTicks'
import { ROW_BOX } from './Skeleton'

export interface BugRowProps {
  bug: BugWithMeta
  selected: boolean
  onSelect: (id: string) => void
  members: WorkspaceMember[]
  viewers: PresenceUser[]
  highlighted: boolean
  /** Picked for a multi-bug export (⌘/Ctrl/Shift-click toggles). */
  picked?: boolean
  onTogglePick?: (id: string) => void
  /** State of the Claude Code session working on this bug, while it is in progress. */
  claudeState?: ClaudeRunState
  /** Checks the bug off (or reopens it) from the circle at the start of the row. */
  onToggleStatus?: (bug: BugWithMeta) => void
}

function areEqual(previous: BugRowProps, next: BugRowProps): boolean {
  const keys = Object.keys(previous) as (keyof BugRowProps)[]
  return (
    keys.length === Object.keys(next).length &&
    keys.every(
      (key) =>
        Object.hasOwn(next, key) && (key === 'viewers' || Object.is(previous[key], next[key])),
    ) &&
    previous.viewers.length === next.viewers.length &&
    previous.viewers.every((viewer, index) => viewer.user_id === next.viewers[index].user_id)
  )
}

export const BugRow = memo(function BugRow({
  bug,
  selected,
  onSelect,
  members,
  viewers,
  highlighted,
  picked = false,
  onTogglePick,
  claudeState,
  onToggleStatus,
}: BugRowProps) {
  const ref = useRef<HTMLButtonElement>(null)
  const savedCount = bug.attachments.length
  const pendingCount = bug.pending?.length ?? 0
  const attachmentCount = savedCount + pendingCount
  const uploadFailed = bug.pending?.some((upload) => upload.error !== undefined) ?? false
  const num = bug.optimistic ? '…' : String(bug.number)
  const resolver = members.find((member) => member.user_id === bug.resolved_by)?.profile ?? null
  const assignee = bug.assignee_id
    ? (members.find((member) => member.user_id === bug.assignee_id)?.profile ?? null)
    : null
  const claudeActive =
    claudeState === 'starting' || claudeState === 'working' || claudeState === 'waiting'

  useEffect(() => {
    if (selected) ref.current?.scrollIntoView({ block: 'nearest' })
  }, [selected])

  // Arrival (DESIGN.md section 8): a realtime row lights up in the accent tint and fades out over
  // 600ms. Opacity only, on its own layer; under reduced motion it holds still for 2s, then goes.
  const flashRef = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    const flash = flashRef.current
    if (!highlighted || !flash || typeof flash.animate !== 'function') return
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
    const animation = flash.animate(
      reduce
        ? [{ opacity: 1 }, { opacity: 1, offset: 0.999 }, { opacity: 0 }]
        : [{ opacity: 1 }, { opacity: 0 }],
      { duration: reduce ? 2000 : ARRIVAL_MS, easing: 'linear', fill: 'forwards' },
    )
    return () => animation.cancel()
  }, [highlighted])

  const resolved = bug.status === 'resolved'
  const viewerNames = viewers.map(
    (viewer) =>
      members.find((member) => member.user_id === viewer.user_id)?.profile.display_name ??
      'Unknown user',
  )

  const kindLabel = bug.kind === 'feature' ? 'feature request' : 'bug'
  const toggleLabel = resolved ? `Reopen #${num}` : `Mark #${num} resolved`
  const toggleTitle = resolved
    ? `Resolved by ${resolver?.display_name ?? 'Unknown user'}. Click to reopen`
    : `Check off this ${kindLabel}`

  return (
    // The check-off circle is a sibling laid over the row's leading slot: a button cannot sit
    // inside the row's own button.
    <div role="none" className="relative">
      <button
        ref={ref}
        type="button"
        role="option"
        aria-selected={selected}
        aria-label={`#${num} ${bug.title}`}
        data-highlighted={highlighted || undefined}
        data-picked={picked || undefined}
        data-status={bug.status}
        onClick={(e) => {
          if (onTogglePick && (e.metaKey || e.ctrlKey || e.shiftKey)) onTogglePick(bug.id)
          else onSelect(bug.id)
        }}
        className={cn(
          ROW_BOX,
          'focus-ring-inset relative isolate w-full cursor-default text-left',
          selected
            ? 'bg-accent-tint shadow-[inset_2px_0_0_var(--accent)]'
            : picked
              ? 'bg-accent-tint/60 hover:bg-accent-tint'
              : 'hover:bg-surface-3',
        )}
      >
        <span
          ref={flashRef}
          aria-hidden="true"
          className={cn(
            'pointer-events-none absolute inset-0 -z-10 bg-accent-tint opacity-0',
            highlighted && 'opacity-100',
          )}
        />
        {onToggleStatus && <span aria-hidden="true" className="size-[16px] shrink-0" />}
        {picked ? (
          <span className="flex size-[16px] shrink-0 items-center justify-center text-accent">
            <SquareCheck size={14} strokeWidth={1.75} aria-label="Picked" />
          </span>
        ) : (
          <SeverityTicks severity={bug.severity} />
        )}
        <span className="w-[4ch] shrink-0 text-right font-mono text-xs font-medium text-ink-3 tabular-nums">
          #{num}
        </span>
        <span className="flex min-w-0 flex-1">
          <span
            className={cn(
              'relative max-w-full truncate text-base font-medium',
              resolved ? 'text-ink-3' : 'text-ink',
              // Resolve: a 1px strike drawn left to right (transform only).
              'after:pointer-events-none after:absolute after:inset-x-0 after:top-1/2 after:h-px after:origin-left after:bg-current after:transition-transform after:duration-[220ms] after:ease-(--ease-out)',
              resolved ? 'after:scale-x-100' : 'after:scale-x-0',
            )}
            title={bug.title}
          >
            {bug.title}
          </span>
        </span>
        {/* Meta column, always in this order: Claude status, screenshots, viewers, resolved (when the row has
          no check-off circle); then
          the time and the person pinned right. Sized to its content so titles take the rest. */}
        <span className="flex shrink-0 items-center gap-2.5 text-ink-3">
          {claudeActive && (
            <span
              className={cn(
                'inline-flex',
                claudeState === 'waiting' ? 'text-warning' : 'text-accent',
              )}
              title={
                claudeState === 'waiting' ? 'Claude needs you in Terminal' : 'Claude is working'
              }
            >
              <Sparkle
                size={14}
                strokeWidth={1.75}
                aria-label={claudeState === 'waiting' ? 'Claude needs you' : 'Claude is working'}
              />
            </span>
          )}
          {attachmentCount > 0 && (
            <span
              className={cn(
                'hidden items-center gap-1 font-mono text-xs tabular-nums sm:inline-flex',
                uploadFailed && 'text-danger',
              )}
              title={
                uploadFailed
                  ? 'A screenshot failed to upload'
                  : pendingCount > 0
                    ? 'Uploading screenshots'
                    : `${attachmentCount} screenshot${attachmentCount === 1 ? '' : 's'}`
              }
            >
              <ImageIcon
                size={14}
                strokeWidth={1.5}
                aria-label={`${attachmentCount} screenshot${attachmentCount === 1 ? '' : 's'}`}
              />
              {attachmentCount > 1 && <span aria-hidden="true">{attachmentCount}</span>}
            </span>
          )}
          {viewers.length > 0 && (
            // Teammates with this bug open right now, named in the tooltip. Part of the meta column;
            // dropped below `sm` so narrow titles keep their room.
            <span
              className="hidden items-center gap-0.5 text-ink-2 sm:inline-flex"
              aria-label="Currently viewing"
              title={viewerTitle(viewerNames)}
            >
              <Eye size={14} strokeWidth={1.5} aria-hidden="true" />
              {viewers.length > 1 && (
                <span aria-hidden="true" className="font-mono text-label tabular-nums">
                  {viewers.length}
                </span>
              )}
            </span>
          )}
          {resolved && !onToggleStatus && (
            <span
              className="inline-flex text-status-resolved"
              title={`Resolved by ${resolver?.display_name ?? 'Unknown user'}`}
            >
              <CircleCheck size={14} strokeWidth={1.5} aria-label="Resolved" />
            </span>
          )}
          <time
            dateTime={bug.created_at}
            title={new Date(bug.created_at).toLocaleString()}
            className="shrink-0 text-right font-mono text-xs whitespace-nowrap tabular-nums"
          >
            {relativeTime(bug.created_at)}
          </time>
          {bug.assignee_id ? (
            <span
              className="inline-flex"
              title={`Assigned to ${assignee?.display_name ?? 'a former member'}`}
            >
              <Avatar profile={assignee} size="xs" />
            </span>
          ) : (
            // The person slot only ever means the assignee: unassigned is an empty dashed disc of
            // the same size, never the filer standing in (one person, one meaning, one colour).
            <span
              role="img"
              aria-label="Unassigned"
              title="Unassigned"
              className="inline-flex size-[20px] shrink-0 rounded-full border border-dashed border-line-input"
            />
          )}
        </span>
      </button>
      {onToggleStatus && !bug.optimistic && (
        <button
          type="button"
          // Keyboard users have R on the selected row; one tab stop per row stays the row itself.
          tabIndex={-1}
          aria-label={toggleLabel}
          aria-pressed={resolved}
          title={toggleTitle}
          data-status-toggle
          onClick={() => onToggleStatus(bug)}
          className="group/check absolute top-1/2 left-[24px] flex size-[32px] -translate-x-1/2 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full pointer-coarse:size-[44px]"
        >
          <span
            aria-hidden="true"
            className={cn(
              't flex size-[16px] items-center justify-center rounded-full border',
              resolved
                ? 'border-status-resolved text-status-resolved'
                : 'border-ink-3 text-transparent group-hover/check:border-status-resolved group-hover/check:text-status-resolved',
            )}
          >
            <Check size={11} strokeWidth={2.5} />
          </span>
        </button>
      )}
    </div>
  )
}, areEqual)

const ARRIVAL_MS = 600

function viewerTitle(names: string[]): string {
  if (names.length === 1) return `${names[0]} is viewing`
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]} are viewing`
}
