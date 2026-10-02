import { Bug, CircleCheck, Search } from 'lucide-react'
import type { BugFilters } from '../hooks/useBugs'

export interface EmptyStateProps {
  tab: BugFilters['tab']
  filtered: boolean
}

export function EmptyState({ tab, filtered }: EmptyStateProps) {
  const Icon = filtered ? Search : tab === 'open' ? CircleCheck : Bug
  const message = filtered
    ? 'No bugs match.'
    : tab === 'open'
      ? 'No open bugs. Ship it.'
      : tab === 'resolved'
        ? 'Nothing resolved yet.'
        : 'File your first bug above.'

  return (
    <div
      role="status"
      className="flex flex-col items-center gap-3 px-4 py-16 text-center text-sm text-muted"
    >
      <Icon size={24} strokeWidth={1.5} aria-hidden="true" />
      <p>{message}</p>
    </div>
  )
}
