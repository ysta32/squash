import { Badge, Section } from '../ui'
import { useDeletionLog } from '../../hooks/useDeletionLog'
import { relativeTime } from '../../lib/utils'

export function DeletionLog({
  workspaceId,
  members,
}: {
  workspaceId: string
  members: { user_id: string; profile: { display_name: string } }[]
}) {
  const { deletions, loading, error } = useDeletionLog(workspaceId)
  const names = new Map(members.map((member) => [member.user_id, member.profile.display_name]))

  return (
    <Section
      title="Recently deleted"
      description="The last 50 bugs and feature requests deleted from this workspace."
    >
      {loading ? (
        <p role="status" className="text-sm text-muted">
          Loading deleted items…
        </p>
      ) : error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : deletions.length === 0 ? (
        <p className="text-sm text-muted">Nothing has been deleted.</p>
      ) : (
        <ul className="-my-2 divide-y divide-border">
          {deletions.map((item) => (
            <li key={item.id} className="flex min-h-12 items-center gap-3 py-2">
              <span className="text-sm text-muted tabular-nums">#{item.bug_number}</span>
              <Badge tone="neutral" className="capitalize">
                {item.kind}
              </Badge>
              <span className="min-w-0 flex-1 text-sm font-medium break-words">{item.title}</span>
              <span className="text-xs text-muted">
                {(item.deleted_by && names.get(item.deleted_by)) || 'Deleted user'} ·{' '}
                {relativeTime(item.deleted_at)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Section>
  )
}
