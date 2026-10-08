import { useDeletionLog } from '../../hooks/useDeletionLog'
import { relativeTime } from '../../lib/utils'
import { LedgerGroup, SettingsPanel } from './Ledger'

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
    <SettingsPanel
      id="deleted"
      title="Recently deleted"
      description="Deleted bugs are removed for good. Their number, title and who deleted them stay listed here for every member of this workspace (the last 50)."
    >
      <LedgerGroup
        title="Bugs"
        meta={!loading && !error ? <span className="nums">{deletions.length}</span> : undefined}
      >
        {loading ? (
          <div role="status" aria-label="Loading deleted items">
            <span className="sr-only">Loading deleted items…</span>
            {[0.55, 0.4, 0.65].map((width) => (
              <div
                key={width}
                aria-hidden="true"
                className="flex h-12 items-center gap-4 border-b border-line"
              >
                <span className="h-3 w-8 animate-skeleton rounded-sm bg-surface-3" />
                <span
                  className="h-3 animate-skeleton rounded-sm bg-surface-3"
                  style={{ width: `${width * 100}%` }}
                />
              </div>
            ))}
          </div>
        ) : error ? (
          <p role="alert" className="py-4 text-sm text-danger">
            {error}
          </p>
        ) : deletions.length === 0 ? (
          <p className="py-4 text-sm text-ink-3">Nothing has been deleted.</p>
        ) : (
          <ul>
            {deletions.map((item) => (
              <li
                key={item.id}
                className="grid grid-cols-[4ch_minmax(0,1fr)] items-baseline gap-x-4 gap-y-0.5 border-b border-line py-3 sm:grid-cols-[4ch_minmax(0,1fr)_auto]"
              >
                <span className="text-right font-mono text-sm font-medium text-ink-3 nums">
                  #{item.bug_number}
                </span>
                <span className="min-w-0 text-base break-words text-ink-2">
                  {item.title}
                  <span className="specimen-label ml-2 text-ink-3">{item.kind}</span>
                </span>
                <span className="col-start-2 font-mono text-xs text-ink-3 sm:col-start-3">
                  {(item.deleted_by && names.get(item.deleted_by)) || 'Deleted user'} ·{' '}
                  <time
                    dateTime={item.deleted_at}
                    title={new Date(item.deleted_at).toLocaleString()}
                  >
                    {relativeTime(item.deleted_at)}
                  </time>
                </span>
              </li>
            ))}
          </ul>
        )}
      </LedgerGroup>
    </SettingsPanel>
  )
}
