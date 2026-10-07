import type { WorkspaceMember } from '../lib/types'
import type { PresenceUser } from '../hooks/usePresence'
import { Avatar } from './Avatar'

const MAX_SHOWN = 5

export interface PresenceAvatarsProps {
  online: PresenceUser[]
  members: WorkspaceMember[]
  selfId: string
}

export function PresenceAvatars({ online, members, selfId }: PresenceAvatarsProps) {
  const byId = new Map(members.map((m) => [m.user_id, m]))
  const others = online
    .filter((u) => u.user_id !== selfId)
    .map((u) => byId.get(u.user_id))
    .filter((m): m is WorkspaceMember => m !== undefined)
  if (others.length === 0) return null
  const shown = others.slice(0, MAX_SHOWN)
  const extra = others.length - shown.length

  return (
    <div className="flex items-center -space-x-2">
      {shown.map((m) => (
        <span key={m.user_id} title={m.profile.display_name} className="inline-flex">
          <Avatar profile={m.profile} size="sm" ring />
        </span>
      ))}
      {extra > 0 && (
        <span className="z-10 inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-bg-subtle px-1 text-xs font-semibold text-muted ring-2 ring-bg">
          +{extra}
        </span>
      )}
    </div>
  )
}
