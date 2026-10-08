import type { ComponentType, ReactNode } from 'react'
import { Bug, CircleCheck, Lightbulb, Search } from 'lucide-react'
import type { BugFilters } from '../hooks/useBugs'
import { cn, isMac } from '../lib/utils'
import { Button, Kbd } from './ui'

/** Faint lab-notebook rules behind an empty state (DESIGN.md motif 3), fading out from the top left. */
export function RuledPaper({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        'pointer-events-none absolute inset-0 -z-10 bg-[repeating-linear-gradient(to_bottom,transparent_0,transparent_23px,var(--border-1)_23px,var(--border-1)_24px)] [mask-image:radial-gradient(130%_100%_at_0%_0%,black_10%,transparent_75%)]',
        className,
      )}
    />
  )
}

export interface StatePanelProps {
  icon: ComponentType<{ size?: number; strokeWidth?: number; className?: string }>
  title: ReactNode
  body?: ReactNode
  /** Key hints or a short guide, shown under the body. */
  hints?: ReactNode
  action?: ReactNode
  role?: 'status' | 'alert'
  tone?: 'default' | 'danger'
  /** `deep`: the wide detail pane (lower start, detail-column gutter, no ruled paper). */
  inset?: 'default' | 'deep'
  className?: string
}

/**
 * The one empty / error state layout (DESIGN.md "States"): left-aligned, a 20px icon, one base
 * 500 line, one sm text-2 line, an action, over faint ruled paper. No illustrations. Every line
 * box is 24px and every gap a multiple of 24px, so text sits on the rules instead of being struck
 * through by them.
 */
export function StatePanel({
  icon: Icon,
  title,
  body,
  hints,
  action,
  role,
  tone = 'default',
  inset = 'default',
  className,
}: StatePanelProps) {
  return (
    <div
      role={role}
      className={cn(
        'relative isolate px-4 pb-[48px]',
        // In the list the text shares the rows' px-4 gutter over ruled paper. The wide detail pane
        // lines up with the bug detail column (48px from the rule) on plain paper: rules across
        // ~1500px read as noise, not as a notebook.
        inset === 'deep' ? 'pt-[72px] sm:px-6 lg:px-[48px]' : 'pt-[48px]',
        className,
      )}
    >
      {inset !== 'deep' && <RuledPaper />}
      <div className="max-w-[24rem]">
        <div className="flex h-[24px] items-center">
          <Icon
            size={20}
            strokeWidth={1.5}
            className={tone === 'danger' ? 'text-danger' : 'text-ink-3'}
          />
        </div>
        <h2 className="text-base leading-[24px] font-medium text-ink">{title}</h2>
        {body && <p className="text-sm leading-[24px] text-ink-2">{body}</p>}
        {hints && <div className="mt-[24px]">{hints}</div>}
        {action && <div className="mt-[24px] flex flex-wrap items-center gap-2">{action}</div>}
      </div>
    </div>
  )
}

export interface EmptyStateProps {
  kind?: BugFilters['kind']
  tab: BugFilters['tab']
  filtered: boolean
  hasItems?: boolean
  /** Search text to quote back; pass it only when search is the sole active filter. */
  query?: string
  onClearFilters?: () => void
}

/** One ruled line per hint (see StatePanel). */
export const HINT_ROW = 'flex h-[24px] items-center gap-2 text-sm text-ink-2'

export function EmptyState({
  kind = 'bug',
  tab,
  filtered,
  hasItems = false,
  query = '',
  onClearFilters,
}: EmptyStateProps) {
  const feature = kind === 'feature'
  const items = feature ? 'feature requests' : 'bugs'
  const firstItem = !filtered && !hasItems && tab !== 'resolved'
  const Icon = filtered ? Search : firstItem ? (feature ? Lightbulb : Bug) : CircleCheck
  const scope = tab === 'all' ? '' : `${tab} `
  const heading = filtered
    ? 'No matches'
    : tab === 'resolved'
      ? 'Nothing resolved yet'
      : firstItem
        ? `File your first ${feature ? 'feature request' : 'bug'}`
        : 'Nothing open'
  const body = filtered
    ? query.trim()
      ? `No ${scope}${items} match “${query.trim()}”.`
      : `No ${items} match these filters.`
    : tab === 'resolved'
      ? `Resolved ${items} will appear here.`
      : firstItem
        ? feature
          ? 'Paste a screenshot anywhere, describe your feature request, press Enter.'
          : "Paste a screenshot anywhere, describe what's wrong, press Enter."
        : `Every ${feature ? 'feature request' : 'bug'} here has been resolved.`

  return (
    <StatePanel
      role="status"
      icon={Icon}
      title={heading}
      body={body}
      hints={
        firstItem ? (
          <ol aria-label="How to file">
            <li className={HINT_ROW}>
              <Kbd className="min-w-9">{isMac ? '⌘V' : 'Ctrl V'}</Kbd> Paste a screenshot
            </li>
            <li className={HINT_ROW}>
              <Kbd className="min-w-9">N</Kbd>
              {feature ? 'Describe the feature request' : 'Describe the bug'}
            </li>
            <li className={HINT_ROW}>
              <Kbd className="min-w-9">↵</Kbd> Submit
            </li>
          </ol>
        ) : !filtered && tab !== 'resolved' ? (
          <p className={HINT_ROW}>
            <Kbd>N</Kbd> files the next one
          </p>
        ) : undefined
      }
      action={
        filtered && onClearFilters ? (
          <Button variant="secondary" size="sm" onClick={onClearFilters}>
            Clear filters
          </Button>
        ) : undefined
      }
    />
  )
}
