import type { RefObject } from 'react'
import { Bot, Search, X } from 'lucide-react'
import { filterBugs } from '../hooks/useBugs'
import type { BugFilters as Filters } from '../hooks/useBugs'
import type { PresenceUser } from '../hooks/usePresence'
import type { BugWithMeta, WorkspaceMember } from '../lib/types'
import { cn } from '../lib/utils'
import { BugFilters } from './BugFilters'
import { BugRow } from './BugRow'
import { EmptyState } from './EmptyState'
import { Skeleton } from './Skeleton'

export interface BugListProps {
  bugs: BugWithMeta[]
  loading: boolean
  counts: { open: number; resolved: number; all: number }
  filters: Filters
  onFilters: (filters: Filters) => void
  selectedId: string | null
  onSelect: (id: string) => void
  members: WorkspaceMember[]
  viewersOf: (bugId: string) => PresenceUser[]
  highlightIds: Set<string>
  searchRef?: RefObject<HTMLInputElement | null>
  /** Bugs picked for a multi-bug Claude export. */
  pickedIds?: Set<string>
  onTogglePick?: (id: string) => void
  onClearPicked?: () => void
  /** Sends bugs to Claude Code (or copies them when the local bridge is not running). */
  onExport?: (bugs: BugWithMeta[]) => void
  bridge?: boolean
}

export function BugList({
  bugs,
  loading,
  counts,
  filters,
  onFilters,
  selectedId,
  onSelect,
  members,
  viewersOf,
  highlightIds,
  searchRef,
  pickedIds,
  onTogglePick,
  onClearPicked,
  onExport,
  bridge = false,
}: BugListProps) {
  const visible = filterBugs(bugs, filters)
  const picked = pickedIds ? bugs.filter((b) => pickedIds.has(b.id)) : []
  const exportable = picked.length > 0 ? picked : visible.filter((b) => !b.optimistic)
  const verb = bridge ? 'Send' : 'Copy'
  const filtered = Boolean(
    filters.query.trim() || filters.filedBy || filters.resolvedBy || filters.severity,
  )

  return (
    <section aria-label="Bug list" className="flex h-full min-h-0 flex-col bg-bg text-fg">
      <div className="space-y-3 border-b border-border p-3">
        <div role="group" aria-label="Bug status" className="flex gap-1">
          {(['open', 'resolved', 'all'] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              aria-pressed={filters.tab === tab}
              onClick={() => onFilters({ ...filters, tab })}
              className={cn(
                't flex items-center gap-2 rounded-md px-3 py-1.5 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
                filters.tab === tab
                  ? 'bg-bg-subtle text-fg'
                  : 'text-muted hover:bg-bg-subtle hover:text-fg',
              )}
            >
              {tab === 'open' ? 'Open' : tab === 'resolved' ? 'Resolved' : 'All'}{' '}
              <span className="font-mono text-muted">{counts[tab]}</span>
            </button>
          ))}
          {onExport && exportable.length > 0 && (
            <div className="ml-auto flex items-center gap-1">
              {picked.length > 0 && onClearPicked && (
                <button
                  type="button"
                  onClick={onClearPicked}
                  aria-label="Clear picked bugs"
                  title="Clear picked bugs"
                  className="t rounded-md p-1.5 text-muted hover:bg-bg-subtle hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                >
                  <X size={14} aria-hidden="true" />
                </button>
              )}
              <button
                type="button"
                onClick={() => onExport(exportable)}
                title={
                  picked.length > 0
                    ? `${verb} the picked bugs to Claude (C)`
                    : `${verb} every bug in this view to Claude. ⌘/Ctrl-click or press X to pick specific bugs.`
                }
                className="t inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs text-muted hover:bg-bg-subtle hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                <Bot size={14} aria-hidden="true" />
                {picked.length > 0
                  ? `${verb} ${picked.length} to Claude`
                  : `${verb} all ${exportable.length} to Claude`}
              </button>
            </div>
          )}
        </div>
        <label className="relative block">
          <Search
            size={14}
            aria-hidden="true"
            className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted"
          />
          <input
            ref={searchRef}
            type="search"
            aria-label="Search bugs"
            placeholder="Search  /"
            value={filters.query}
            onChange={(event) => onFilters({ ...filters, query: event.target.value })}
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                event.stopPropagation()
                event.nativeEvent.stopImmediatePropagation()
                onFilters({ ...filters, query: '' })
                event.currentTarget.blur()
              }
            }}
            className="t w-full rounded-md border border-border bg-bg py-2 pl-8 pr-3 text-sm placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent"
          />
        </label>
        <BugFilters filters={filters} onFilters={onFilters} members={members} />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto" aria-busy={loading}>
        {loading ? (
          <Skeleton />
        ) : visible.length === 0 ? (
          <EmptyState tab={filters.tab} filtered={filtered} />
        ) : (
          <div role="listbox" aria-label="Bugs" className="space-y-1 p-2">
            {visible.map((bug) => (
              <BugRow
                key={bug.id}
                bug={bug}
                selected={bug.id === selectedId}
                onSelect={onSelect}
                members={members}
                viewers={viewersOf(bug.id)}
                highlighted={highlightIds.has(bug.id)}
                picked={pickedIds?.has(bug.id) ?? false}
                onTogglePick={onTogglePick}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
