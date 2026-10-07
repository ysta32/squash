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

export interface ActivityTimelineProps {
  events: BugEvent[]
  members: WorkspaceMember[]
}

export function ActivityTimeline({ events, members }: ActivityTimelineProps) {
  const names = new Map(members.map((m) => [m.user_id, m.profile.display_name]))
  const sorted = [...events].sort((a, b) => a.created_at.localeCompare(b.created_at))
  if (sorted.length === 0) return <p className="text-xs text-muted">No activity yet.</p>

  return (
    <ol className="text-xs">
      {sorted.map((ev, i) => {
        const Icon = ICON[ev.type]
        const showNote = (ev.type === 'resolved' || ev.type === 'reopened') && ev.note
        const last = i === sorted.length - 1
        return (
          <li key={ev.id} className={cn('relative flex items-start gap-3', !last && 'pb-3')}>
            {!last && (
              <span
                aria-hidden="true"
                className="absolute top-5 bottom-0 left-[9.5px] w-px bg-border"
              />
            )}
            <span className="relative inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-border bg-bg text-muted">
              <Icon className="h-3 w-3" aria-hidden="true" />
            </span>
            <div className="min-w-0 pt-0.5">
              <p className="text-muted">
                <span className="font-medium text-fg">
                  {names.get(ev.actor_id) ?? 'Deleted user'}
                </span>{' '}
                {ev.type === 'assigned' ? assignedVerb(ev, names) : VERB[ev.type]} ·{' '}
                <time dateTime={ev.created_at} title={new Date(ev.created_at).toLocaleString()}>
                  {relativeTime(ev.created_at)}
                </time>
              </p>
              {showNote && (
                <p className="mt-1 [overflow-wrap:anywhere] whitespace-pre-wrap text-muted italic">
                  {ev.note}
                </p>
              )}
            </div>
          </li>
        )
      })}
    </ol>
  )
}
