import { useState } from 'react'
import { BellDot, Check, RotateCcw } from 'lucide-react'
import { useNow } from '../hooks/useNow'
import { UPDATES_WINDOW_DAYS, type UpdateItem } from '../lib/updates'
import { KIND_LABEL } from '../lib/types'
import type { BugWithMeta, WorkspaceMember } from '../lib/types'
import { cn, relativeTime } from '../lib/utils'
import { StatePanel } from './EmptyState'
import { KIND_ICON } from './kindIcon'
import { Button } from './ui'

export interface UpdatesListProps {
  items: UpdateItem[]
  members: WorkspaceMember[]
  selfId?: string
  /** Number of the item open in the detail pane, to mark it. */
  selectedNumber: number | null
  onOpen: (number: number) => void
  /** "Looks good": marks items reviewed. */
  onReview: (bugs: BugWithMeta[]) => void
  /** Not actually done: reopens the item. */
  onReopen: (bug: BugWithMeta) => Promise<void>
}

function UpdateCard({
  item,
  resolver,
  selected,
  now,
  onOpen,
  onReview,
  onReopen,
}: {
  item: UpdateItem
  resolver: string
  selected: boolean
  now: Date
  onOpen: (number: number) => void
  onReview: (bugs: BugWithMeta[]) => void
  onReopen: (bug: BugWithMeta) => Promise<void>
}) {
  const { bug, isNew } = item
  const Icon = KIND_ICON[bug.kind]
  const [reopening, setReopening] = useState(false)
  const resolvedAt = bug.resolved_at ?? bug.updated_at

  return (
    <li
      aria-label={`${isNew ? 'New: ' : ''}${KIND_LABEL[bug.kind].one} #${bug.number} resolved`}
      className={cn(
        'border-b border-line px-4 py-3',
        selected && 'bg-surface-2',
        isNew && 'border-l-2 border-l-accent',
      )}
    >
      <p className="flex min-w-0 items-center gap-2 text-xs text-ink-3">
        {isNew && (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-xs bg-accent-tint px-1.5 font-medium text-accent">
            New
          </span>
        )}
        <span className="min-w-0 truncate">Resolved by {resolver}</span>
        <time
          dateTime={resolvedAt}
          title={new Date(resolvedAt).toLocaleString()}
          className="ml-auto shrink-0 font-mono"
        >
          {relativeTime(resolvedAt, now)}
        </time>
      </p>

      <button
        type="button"
        onClick={() => onOpen(bug.number)}
        aria-current={selected ? 'true' : undefined}
        title={`Open ${KIND_LABEL[bug.kind].one.toLowerCase()} #${bug.number}`}
        className="t focus-ring -mx-1.5 mt-1.5 flex w-[calc(100%+0.75rem)] min-w-0 items-center gap-2 rounded-sm px-1.5 py-1 text-left text-sm font-medium text-ink hover:bg-surface-3 pointer-coarse:min-h-11"
      >
        <Icon size={14} strokeWidth={1.5} aria-hidden="true" className="shrink-0 text-ink-3" />
        <span className="shrink-0 font-mono text-xs font-normal text-ink-3">#{bug.number}</span>
        <span className="min-w-0 truncate">{bug.title}</span>
      </button>

      <div className="mt-1.5">
        <p className="specimen-label">What happened</p>
        <p className="mt-1 line-clamp-6 text-sm [overflow-wrap:anywhere] text-pretty whitespace-pre-wrap text-ink-2">
          {bug.resolution_note?.trim() || 'Resolved without a note.'}
        </p>
      </div>

      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
        {isNew ? (
          <Button variant="secondary" size="sm" onClick={() => onReview([bug])}>
            <Check size={14} strokeWidth={1.5} aria-hidden="true" /> Looks good
          </Button>
        ) : (
          <span className="inline-flex items-center gap-1 px-1 text-xs text-ink-3">
            <Check size={12} strokeWidth={1.5} aria-hidden="true" /> Reviewed
          </span>
        )}
        <Button
          variant="ghost"
          size="sm"
          pending={reopening}
          pendingLabel="Reopening…"
          onClick={() => {
            setReopening(true)
            void onReopen(bug).finally(() => setReopening(false))
          }}
        >
          <RotateCcw size={14} strokeWidth={1.5} aria-hidden="true" /> Reopen
        </Button>
      </div>
    </li>
  )
}

/**
 * The Updates view: everything resolved in the last 30 days (by Claude Code, a teammate or you),
 * newest first, with what happened. New ones are marked until you check them with "Looks good",
 * and anything not really done can be reopened from here.
 */
export function UpdatesList({
  items,
  members,
  selfId,
  selectedNumber,
  onOpen,
  onReview,
  onReopen,
}: UpdatesListProps) {
  const now = useNow(items.length > 0)
  const fresh = items.filter((item) => item.isNew).map((item) => item.bug)
  const name = (id: string | null) => {
    if (id && id === selfId) return 'you'
    return members.find((m) => m.user_id === id)?.profile.display_name ?? 'a former member'
  }

  if (items.length === 0) {
    return (
      <StatePanel
        role="status"
        icon={BellDot}
        title="No updates yet"
        body={`When Claude Code or a teammate finishes something, it lands here with what happened, so you can check it and reopen it if it is not done. Shows the last ${UPDATES_WINDOW_DAYS} days.`}
      />
    )
  }

  return (
    <div>
      <div className="flex min-h-[2.8571rem] items-center gap-2 border-b border-line px-4 py-1.5 text-xs text-ink-3">
        <p role="status" className="min-w-0 flex-1">
          {fresh.length > 0
            ? `${fresh.length} new to review`
            : `All caught up · last ${UPDATES_WINDOW_DAYS} days`}
        </p>
        {fresh.length > 1 && (
          <Button variant="ghost" size="sm" onClick={() => onReview(fresh)}>
            <Check size={14} strokeWidth={1.5} aria-hidden="true" /> Mark all reviewed
          </Button>
        )}
      </div>
      <ul aria-label="Updates">
        {items.map((item) => (
          <UpdateCard
            key={item.bug.id}
            item={item}
            resolver={name(item.bug.resolved_by)}
            selected={item.bug.number === selectedNumber}
            now={now}
            onOpen={onOpen}
            onReview={onReview}
            onReopen={onReopen}
          />
        ))}
      </ul>
    </div>
  )
}
