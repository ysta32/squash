import { memo, useEffect, useRef } from 'react'
import { Bot, CircleCheck, Image as ImageIcon, SquareCheck } from 'lucide-react'
import type { PresenceUser } from '../hooks/usePresence'
import type { ClaudeRunState } from '../lib/claudeExport'
import { SEVERITY_COLOR, SEVERITY_LABEL } from '../lib/types'
import type { BugWithMeta, WorkspaceMember } from '../lib/types'
import { cn, relativeTime } from '../lib/utils'
import { Avatar } from './Avatar'

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
}

// Keep bug, members, viewers, onSelect, and onTogglePick references stable for memoization.
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
}: BugRowProps) {
  const ref = useRef<HTMLButtonElement>(null)
  const savedCount = bug.attachments.length
  const pendingCount = bug.pending?.length ?? 0
  const attachmentCount = savedCount + pendingCount
  const uploadFailed = bug.pending?.some((upload) => upload.error !== undefined) ?? false
  const num = bug.optimistic ? '…' : String(bug.number)
  const filer = members.find((member) => member.user_id === bug.filed_by)?.profile ?? null
  const resolver = members.find((member) => member.user_id === bug.resolved_by)?.profile ?? null
  const assignee = bug.assignee_id
    ? (members.find((member) => member.user_id === bug.assignee_id)?.profile ?? null)
    : null
  const claudeActive =
    claudeState === 'starting' || claudeState === 'working' || claudeState === 'waiting'
  const shownViewers = viewers.slice(0, MAX_VIEWERS)
  const extraViewers = viewers.length - shownViewers.length

  useEffect(() => {
    if (selected) ref.current?.scrollIntoView({ block: 'nearest' })
  }, [selected])

  return (
    <button
      ref={ref}
      type="button"
      role="option"
      aria-selected={selected}
      aria-label={`#${num} ${bug.title}`}
      onClick={(e) => {
        if (onTogglePick && (e.metaKey || e.ctrlKey || e.shiftKey)) onTogglePick(bug.id)
        else onSelect(bug.id)
      }}
      className={cn(
        't focus-ring relative flex h-11 w-full items-center gap-2.5 rounded-md pl-3 pr-2.5 text-left',
        highlighted || picked ? 'bg-accent/10' : selected ? 'bg-accent/8' : 'hover:bg-bg-subtle',
        bug.status === 'resolved' && 'opacity-60',
      )}
    >
      {selected && (
        <span
          aria-hidden="true"
          className="absolute inset-y-2 left-0 w-0.5 rounded-full bg-accent"
        />
      )}
      <span className="flex w-3 shrink-0 items-center justify-center">
        {picked ? (
          <SquareCheck size={14} aria-label="Picked" className="text-accent" />
        ) : (
          <span
            className={cn('h-2 w-2 rounded-full', SEVERITY_COLOR[bug.severity])}
            title={`${SEVERITY_LABEL[bug.severity]} severity`}
          />
        )}
      </span>
      <span className="min-w-9 shrink-0 font-mono text-xs tabular-nums text-muted">#{num}</span>
      <span className="min-w-0 flex-1 truncate text-sm font-medium text-fg" title={bug.title}>
        {bug.title}
      </span>
      <span className="flex shrink-0 items-center gap-2 text-xs text-muted">
        {claudeActive && (
          <span
            className={cn(
              'inline-flex animate-pulse motion-reduce:animate-none',
              claudeState === 'waiting' ? 'text-warning' : 'text-accent',
            )}
            title={claudeState === 'waiting' ? 'Claude needs you in Terminal' : 'Claude is working'}
          >
            <Bot
              size={14}
              aria-label={claudeState === 'waiting' ? 'Claude needs you' : 'Claude is working'}
            />
          </span>
        )}
        {attachmentCount > 0 && (
          <span
            className={cn(
              'hidden items-center gap-0.5 tabular-nums sm:inline-flex',
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
              size={13}
              strokeWidth={1.75}
              aria-label={`${attachmentCount} screenshot${attachmentCount === 1 ? '' : 's'}`}
            />
            {attachmentCount > 1 && <span aria-hidden="true">{attachmentCount}</span>}
          </span>
        )}
        {bug.status === 'resolved' && (
          <span
            className="inline-flex text-success"
            title={`Resolved by ${resolver?.display_name ?? 'Unknown user'}`}
          >
            <CircleCheck size={13} strokeWidth={1.75} aria-label="Resolved" />
          </span>
        )}
        <time
          dateTime={bug.created_at}
          title={new Date(bug.created_at).toLocaleString()}
          className="w-12 truncate text-right tabular-nums"
        >
          {relativeTime(bug.created_at)}
        </time>
        {viewers.length > 0 && (
          <span className="inline-flex items-center -space-x-1.5" aria-label="Currently viewing">
            {shownViewers.map((viewer) => {
              const profile =
                members.find((member) => member.user_id === viewer.user_id)?.profile ?? null
              return (
                <span
                  key={viewer.user_id}
                  className="inline-flex rounded-full"
                  title={`${profile?.display_name ?? 'Unknown user'} is viewing`}
                >
                  <Avatar profile={profile} size="xs" ring />
                </span>
              )
            })}
            {extraViewers > 0 && (
              <span className="relative inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-bg-subtle px-1 text-[10px] font-medium tabular-nums text-muted ring-2 ring-bg">
                +{extraViewers}
              </span>
            )}
          </span>
        )}
        {bug.assignee_id ? (
          <span
            className="inline-flex"
            title={`Assigned to ${assignee?.display_name ?? 'a former member'}`}
          >
            <Avatar profile={assignee} size="xs" />
          </span>
        ) : (
          <span className="inline-flex" title={`Filed by ${filer?.display_name ?? 'Unknown user'}`}>
            <Avatar profile={filer} size="xs" />
          </span>
        )}
      </span>
    </button>
  )
})

const MAX_VIEWERS = 3
