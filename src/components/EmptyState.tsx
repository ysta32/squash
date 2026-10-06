import { Bug, CircleCheck, Lightbulb, Search } from 'lucide-react'
import type { BugFilters } from '../hooks/useBugs'

export interface EmptyStateProps {
  kind?: BugFilters['kind']
  tab: BugFilters['tab']
  filtered: boolean
}

export function EmptyState({ kind = 'bug', tab, filtered }: EmptyStateProps) {
  const feature = kind === 'feature'
  const Icon = filtered ? Search : tab === 'open' ? CircleCheck : feature ? Lightbulb : Bug
  const message = filtered
    ? feature
      ? 'No feature requests match.'
      : 'No bugs match.'
    : tab === 'open'
      ? feature
        ? 'No open feature requests.'
        : 'No open bugs. Ship it.'
      : tab === 'resolved'
        ? feature
          ? 'No features shipped yet.'
          : 'Nothing resolved yet.'
        : feature
          ? 'Request your first feature above.'
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
