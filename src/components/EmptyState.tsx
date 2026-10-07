import { Bug, CircleCheck, Lightbulb, Search } from 'lucide-react'
import type { BugFilters } from '../hooks/useBugs'
import { Button, Kbd } from './ui'

export interface EmptyStateProps {
  kind?: BugFilters['kind']
  tab: BugFilters['tab']
  filtered: boolean
  hasItems?: boolean
  onClearFilters?: () => void
}

export function EmptyState({
  kind = 'bug',
  tab,
  filtered,
  hasItems = false,
  onClearFilters,
}: EmptyStateProps) {
  const feature = kind === 'feature'
  const firstItem = !filtered && !hasItems && tab !== 'resolved'
  const Icon = filtered ? Search : firstItem ? (feature ? Lightbulb : Bug) : CircleCheck
  const heading = filtered
    ? 'No matches'
    : tab === 'resolved'
      ? 'Nothing resolved yet'
      : firstItem
        ? `File your first ${feature ? 'feature request' : 'bug'}`
        : 'Nothing open'
  const body = filtered
    ? `No ${feature ? 'feature requests' : 'bugs'} match these filters.`
    : tab === 'resolved'
      ? `Resolved ${feature ? 'feature requests' : 'bugs'} will appear here.`
      : firstItem
        ? feature
          ? 'Paste a screenshot anywhere, describe your feature request, press Enter.'
          : "Paste a screenshot anywhere, describe what's wrong, press Enter."
        : `Every ${feature ? 'feature request' : 'bug'} here has been resolved.`

  return (
    <div
      role="status"
      className="flex flex-col items-center px-6 py-14 text-center text-sm text-muted"
    >
      <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-bg-subtle text-muted">
        <Icon size={18} strokeWidth={1.75} aria-hidden="true" />
      </div>
      <h2 className="text-sm font-medium text-fg">{heading}</h2>
      <p className="mt-1 max-w-xs text-xs leading-relaxed">{body}</p>
      {firstItem && (
        <ol
          aria-label="How to file"
          className="mt-5 flex flex-col items-start gap-2 rounded-lg border border-border bg-bg-subtle/50 px-4 py-3 text-xs"
        >
          <li className="flex items-center gap-2">
            <Kbd>⌘V</Kbd> Paste a screenshot
          </li>
          <li className="flex items-center gap-2">
            <Kbd>type</Kbd> {feature ? 'Describe the feature request' : 'Describe the bug'}
          </li>
          <li className="flex items-center gap-2">
            <Kbd>Enter</Kbd> Submit
          </li>
        </ol>
      )}
      {filtered && onClearFilters && (
        <Button variant="secondary" size="sm" className="mt-4" onClick={onClearFilters}>
          Clear filters
        </Button>
      )}
    </div>
  )
}
