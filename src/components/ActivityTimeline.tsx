import { Check, MessageSquare, Pencil, Plus, RotateCcw, UserCheck } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { BugEvent, EventType, WorkspaceMember } from '../lib/types'
import { cn, relativeTime } from '../lib/utils'

const ICON: Record<EventType, LucideIcon> = {
  filed: Plus,
  resolved: Check,
  reopened: RotateCcw,
  edited: Pencil,
  commented: MessageSquare,
  assigned: UserCheck,
}

const VERB: Record<EventType, string> = {
  filed: 'filed this bug',
  resolved: 'resolved',
  reopened: 'reopened',
  edited: 'edited',
  commented: 'commented',
  assigned: 'changed the assignee',
}

/** The 'assigned' event's note is the new assignee id, or null when unassigned. */
function assignedVerb(ev: BugEvent, names: Map<string, string>): string {
  if (!ev.note) return 'removed the assignee'
  if (ev.note === ev.actor_id) return 'assigned themselves'
  return `assigned ${names.get(ev.note) ?? 'a former member'}`
}

/** Class for a timeline row; `last` drops the rail that joins it to the next row. */
export const TIMELINE_ITEM = 'relative flex min-w-0 items-start gap-3'

/** The 1px rail joining a row's glyph to the next row's. */
export function TimelineRail() {
  return <span aria-hidden="true" className="absolute top-6 -bottom-1 left-[9.5px] w-px bg-line" />
}

/** One activity line in a timeline: a quiet `xs` `text-3` sentence with an icon on the rail. */
export function ActivityEntry({
  event: ev,
  names,
  last = false,
}: {
  event: BugEvent
  names: Map<string, string>
  last?: boolean
}) {
  const Icon = ICON[ev.type]
  const showNote = (ev.type === 'resolved' || ev.type === 'reopened') && ev.note
  return (
    <li className={cn(TIMELINE_ITEM, !last && 'pb-4')}>
      {!last && <TimelineRail />}
      <span className="relative inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-bg text-ink-3">
        <Icon size={14} strokeWidth={1.5} absoluteStrokeWidth aria-hidden="true" />
      </span>
      <div className="min-w-0 pt-0.5 text-xs text-ink-3">
        <p>
          <span className="font-medium text-ink-2">{names.get(ev.actor_id) ?? 'Deleted user'}</span>{' '}
          {ev.type === 'assigned' ? assignedVerb(ev, names) : VERB[ev.type]} ·{' '}
          <time
            dateTime={ev.created_at}
            title={new Date(ev.created_at).toLocaleString()}
            className="font-mono"
          >
            {relativeTime(ev.created_at)}
          </time>
        </p>
        {showNote && (
          <p className="mt-1 max-w-[68ch] border-l-2 border-line-2 pl-3 text-sm [overflow-wrap:anywhere] whitespace-pre-wrap text-ink-2">
            {ev.note}
          </p>
        )}
      </div>
    </li>
  )
}

export interface ActivityTimelineProps {
  events: BugEvent[]
  members: WorkspaceMember[]
}

export function ActivityTimeline({ events, members }: ActivityTimelineProps) {
  const names = new Map(members.map((m) => [m.user_id, m.profile.display_name]))
  const sorted = [...events].sort((a, b) => a.created_at.localeCompare(b.created_at))
  if (sorted.length === 0) return <p className="text-xs text-ink-3">No activity yet.</p>

  return (
    <ol>
      {sorted.map((ev, i) => (
        <ActivityEntry key={ev.id} event={ev} names={names} last={i === sorted.length - 1} />
      ))}
    </ol>
  )
}
