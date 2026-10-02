import { useEffect, useRef } from 'react'
import { Check } from 'lucide-react'
import type { PresenceUser } from '../hooks/usePresence'
import { useSignedUrl } from '../hooks/useSignedUrl'
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
}

export function BugRow({ bug, selected, onSelect, members, viewers, highlighted }: BugRowProps) {
  const ref = useRef<HTMLButtonElement>(null)
  const signedUrl = useSignedUrl(bug.attachments[0]?.storage_path ?? null)
  const thumbnail = bug.optimistic
    ? (bug.pending?.[0]?.previewUrl ?? signedUrl)
    : (signedUrl ?? bug.pending?.[0]?.previewUrl)
  const num = bug.optimistic ? '…' : String(bug.number)
  const filer = members.find((member) => member.user_id === bug.filed_by)?.profile ?? null
  const resolver = members.find((member) => member.user_id === bug.resolved_by)?.profile ?? null

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
      onClick={() => onSelect(bug.id)}
      className={cn(
        't flex min-h-14 w-full items-center gap-3 rounded-md px-3 py-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent',
        selected && 'ring-1 ring-inset ring-accent',
        highlighted ? 'bg-accent/10' : selected ? 'bg-muted/10' : 'hover:bg-bg-subtle',
        bug.status === 'resolved' && 'opacity-60',
      )}
    >
      <span
        className={cn('h-2 w-2 shrink-0 rounded-full', SEVERITY_COLOR[bug.severity])}
        title={`${SEVERITY_LABEL[bug.severity]} severity`}
      />
      <span className="shrink-0 font-mono text-xs text-muted">#{num}</span>
      <span className="min-w-0 flex-1 truncate text-sm" title={bug.title}>
        {bug.title}
      </span>
      {thumbnail && (
        <img
          src={thumbnail}
          alt="Screenshot preview"
          className="h-8 w-8 shrink-0 rounded object-cover"
        />
      )}
      <span
        className="inline-flex shrink-0"
        title={`Filed by ${filer?.display_name ?? 'Unknown user'}`}
      >
        <Avatar profile={filer} size="xs" />
      </span>
      <time
        dateTime={bug.created_at}
        title={new Date(bug.created_at).toLocaleString()}
        className="shrink-0 text-xs text-muted"
      >
        {relativeTime(bug.created_at)}
      </time>
      {bug.status === 'resolved' && (
        <span
          className="inline-flex shrink-0 items-center gap-1"
          title={`Resolved by ${resolver?.display_name ?? 'Unknown user'}`}
        >
          <Check size={12} aria-hidden="true" />
          <Avatar profile={resolver} size="xs" />
        </span>
      )}
      {viewers.length > 0 && (
        <span
          className="inline-flex shrink-0 items-center -space-x-1.5"
          aria-label="Currently viewing"
        >
          {viewers.map((viewer) => {
            const profile =
              members.find((member) => member.user_id === viewer.user_id)?.profile ?? null
            return (
              <span
                key={viewer.user_id}
                className="inline-flex"
                title={`${profile?.display_name ?? 'Unknown user'} is viewing`}
              >
                <Avatar profile={profile} size="xs" ring />
              </span>
            )
          })}
        </span>
      )}
    </button>
  )
}
