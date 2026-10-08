import type { ComponentType, ReactNode } from 'react'
import { CircleCheck, Search } from 'lucide-react'
import type { BugFilters } from '../hooks/useBugs'
import { useCoarsePointer } from '../hooks/useCoarsePointer'
import { KIND_LABEL } from '../lib/types'
import { cn } from '../lib/utils'
import { KIND_ICON } from './kindIcon'
import { Button, ENTER_KEY, Kbd, Keys, MOD_KEY } from './ui'

/**
 * Faint lab-notebook rules (DESIGN.md motif 3) under an empty state's copy: a short block of 24px
 * ruled lines, one per row of the 24px grid, that fades out to the right and downwards. It sits
 * below the text rather than behind it, so no line ever strikes through the icon or the copy.
 */
export function RuledPaper({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        'pointer-events-none h-[120px] bg-[repeating-linear-gradient(to_bottom,transparent_0,transparent_23px,var(--border-1)_23px,var(--border-1)_24px)] [mask-image:linear-gradient(to_bottom,black,transparent),linear-gradient(to_right,black_40%,transparent)] [mask-composite:intersect]',
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
 * 500 line, one sm text-2 line at a readable measure, then an action or faint ruled paper below.
 * No illustrations.
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
        'px-4',
        // In the list the text shares the rows' px-4 gutter, over ruled paper. The wide detail pane
        // lines up with the bug detail column (48px from the rule) on plain paper: rules across
        // ~1500px read as noise, not as a notebook.
        inset === 'deep' ? 'pt-[72px] pb-[48px] sm:px-6 lg:px-[48px]' : 'pt-[48px] pb-[24px]',
        className,
      )}
    >
      {/* 30rem keeps the sm copy at 60ch or so: never a short ragged wrap. */}
      <div className="max-w-[30rem]">
        <div className="flex h-[24px] items-center">
          <Icon
            size={20}
            strokeWidth={1.5}
            className={tone === 'danger' ? 'text-danger' : 'text-ink-3'}
          />
        </div>
        <h2 className="text-base leading-[24px] font-medium text-ink">{title}</h2>
        {body && <p className="mt-0.5 text-sm leading-normal text-ink-2">{body}</p>}
        {hints && <div className="mt-[24px]">{hints}</div>}
        {action && <div className="mt-[24px] flex flex-wrap items-center gap-2">{action}</div>}
      </div>
      {/* Rules under a button read as broken row dividers, so a state with an action (no
          matches, an error to retry) sits on plain paper; the ruled notebook stays for the calm
          "nothing here yet" states. */}
      {inset !== 'deep' && !action && <RuledPaper className="mt-[24px]" />}
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
  inset?: StatePanelProps['inset']
}

/** One 24px line per hint. */
export const HINT_ROW = 'flex h-[24px] items-center gap-2 text-sm text-ink-2'

/** Key caps in a fixed slot, so the hint labels beside chords of any width line up. */
const HINT_KEYS = 'min-w-11'

/** The three-key way to file: paste, describe, submit. On touch there are no keys: tap wording. */
export function FileGuide({
  kind = 'bug',
  className,
}: {
  kind?: BugFilters['kind']
  className?: string
}) {
  const touch = useCoarsePointer()
  if (touch) {
    return <p className={cn(HINT_ROW, className)}>Attach a screenshot, then tap File</p>
  }
  return (
    <ol aria-label="How to file" className={className}>
      <li className={HINT_ROW}>
        <Keys keys={[MOD_KEY, 'V']} className={HINT_KEYS} /> Paste a screenshot
      </li>
      <li className={HINT_ROW}>
        <Keys keys={['N']} className={HINT_KEYS} />
        Describe the {KIND_LABEL[kind].noun}
      </li>
      <li className={HINT_ROW}>
        <Keys keys={[ENTER_KEY]} className={HINT_KEYS} /> Submit
      </li>
    </ol>
  )
}

export function EmptyState({
  kind = 'bug',
  tab,
  filtered,
  hasItems = false,
  query = '',
  onClearFilters,
  inset,
}: EmptyStateProps) {
  const touch = useCoarsePointer()
  const noun = KIND_LABEL[kind].noun
  const items = `${noun}s`
  const firstItem = !filtered && !hasItems && tab !== 'resolved'
  const Icon = filtered ? Search : firstItem ? KIND_ICON[kind] : CircleCheck
  const scope = tab === 'all' ? '' : `${tab} `
  const searchOnly = filtered && query.trim() !== ''
  const heading = filtered
    ? 'No matches'
    : tab === 'resolved'
      ? 'Nothing resolved yet'
      : firstItem
        ? `File your first ${noun}`
        : 'Nothing open'
  const body = filtered
    ? searchOnly
      ? `No ${scope}${items} match “${query.trim()}”.`
      : `No ${items} match these filters.`
    : tab === 'resolved'
      ? `Resolved ${items} will appear here.`
      : firstItem
        ? kind === 'bug'
          ? "Paste a screenshot anywhere and describe what's wrong. No form to fill in."
          : kind === 'test'
            ? 'Paste a screenshot anywhere and describe what to test. No form to fill in.'
            : 'Paste a screenshot anywhere and describe your feature request. No form to fill in.'
        : `Every ${noun} here has been resolved.`

  return (
    <StatePanel
      role="status"
      inset={inset}
      icon={Icon}
      title={heading}
      body={body}
      hints={
        firstItem ? (
          <FileGuide kind={kind} />
        ) : !filtered && tab !== 'resolved' && !touch ? (
          <p className={HINT_ROW}>
            <Kbd>N</Kbd> File the next one
          </p>
        ) : undefined
      }
      action={
        filtered && onClearFilters ? (
          <Button variant="secondary" size="sm" onClick={onClearFilters}>
            {searchOnly ? 'Clear search' : 'Clear filters'}
          </Button>
        ) : undefined
      }
    />
  )
}
