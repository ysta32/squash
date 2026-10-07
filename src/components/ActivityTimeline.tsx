import { Check, MessageSquare, Pencil, Plus, RotateCcw, UserCheck } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { BugEvent, EventType, WorkspaceMember } from '../lib/types'
import { relativeTime } from '../lib/utils'

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

export interface ActivityTimelineProps {
  events: BugEvent[]
  members: WorkspaceMember[]
}

export function ActivityTimeline({ events, members }: ActivityTimelineProps) {
  const names = new Map(members.map((m) => [m.user_id, m.profile.display_name]))
  const sorted = [...events].sort((a, b) => a.created_at.localeCompare(b.created_at))
  if (sorted.length === 0) return <p className="text-xs text-muted">No activity yet.</p>

  return (
    <ol className="space-y-2">
      {sorted.map((ev) => {
        const Icon = ICON[ev.type]
        const showNote = (ev.type === 'resolved' || ev.type === 'reopened') && ev.note
        return (
          <li key={ev.id} className="flex items-start gap-2 text-xs">
            <span className="mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-bg-subtle text-muted">
              <Icon className="h-3 w-3" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="text-muted">
                <span className="font-medium text-fg">
                  {names.get(ev.actor_id) ?? 'Deleted user'}
                </span>{' '}
                {VERB[ev.type]} ·{' '}
                <time dateTime={ev.created_at} title={new Date(ev.created_at).toLocaleString()}>
                  {relativeTime(ev.created_at)}
                </time>
              </p>
              {showNote && (
                <p className="mt-0.5 break-words whitespace-pre-wrap text-muted italic">
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
