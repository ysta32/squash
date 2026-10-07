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
      className="flex flex-col items-center gap-3 px-4 py-16 text-center text-sm text-muted"
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-bg-subtle">
        <Icon size={24} strokeWidth={1.5} aria-hidden="true" />
      </div>
      <h2 className="text-base font-medium text-fg">{heading}</h2>
      <p className="max-w-sm">{body}</p>
      {firstItem && (
        <ol aria-label="How to file" className="flex flex-wrap justify-center gap-4 text-xs">
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
        <Button variant="ghost" onClick={onClearFilters}>
          Clear filters
        </Button>
      )}
    </div>
  )
}
