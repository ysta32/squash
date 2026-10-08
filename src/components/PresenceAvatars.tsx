import type { WorkspaceMember } from '../lib/types'
import type { PresenceUser } from '../hooks/usePresence'
import { Avatar } from './Avatar'

const MAX_SHOWN = 4

export interface PresenceAvatarsProps {
  online: PresenceUser[]
  members: WorkspaceMember[]
  selfId: string
}

/** Stack of other members currently online, followed by a divider separating it from header actions. */
export function PresenceAvatars({ online, members, selfId }: PresenceAvatarsProps) {
  const byId = new Map(members.map((m) => [m.user_id, m]))
  const seen = new Set<string>()
  const others = online
    .filter((u) => u.user_id !== selfId && !seen.has(u.user_id) && seen.add(u.user_id))
    .map((u) => byId.get(u.user_id))
    .filter((m): m is WorkspaceMember => m !== undefined)
  if (others.length === 0) return null
  const shown = others.slice(0, MAX_SHOWN)
  const hidden = others.slice(MAX_SHOWN)
  const names = others.map((m) => m.profile.display_name).join(', ')
  const label = `${others.length} online: ${names}`

  return (
    <div className="mr-1 flex items-center gap-2.5 sm:mr-2 sm:gap-3">
      <div role="group" aria-label={label} title={label} className="flex items-center">
        <span aria-hidden="true" className="mr-1.5 h-1.5 w-1.5 rounded-full bg-success sm:mr-2" />
        <span aria-hidden="true" className="font-mono text-xs text-ink-2 tabular-nums sm:hidden">
          {others.length}
        </span>
        <div className="hidden items-center -space-x-0.5 sm:flex">
          {shown.map((m, i) => (
            <span
              key={m.user_id}
              title={m.profile.display_name}
              className="relative inline-flex rounded-full"
              style={{ zIndex: shown.length - i }}
            >
              <Avatar profile={m.profile} size="sm" className="ring-2 ring-bg" />
            </span>
          ))}
          {hidden.length > 0 && (
            <span
              title={hidden.map((m) => m.profile.display_name).join(', ')}
              className="relative inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-surface-3 px-1 font-mono text-label text-ink-2 tabular-nums ring-2 ring-bg"
            >
              +{hidden.length}
            </span>
          )}
        </div>
      </div>
      <span aria-hidden="true" className="h-4 w-px bg-line-2" />
    </div>
  )
}
