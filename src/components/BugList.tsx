import type { RefObject } from 'react'
import { useParams } from 'react-router-dom'
import { Bot, Bug, Copy, FolderCog, Lightbulb, Search, X } from 'lucide-react'
import { filterBugs } from '../hooks/useBugs'
import type { BugFilters as Filters } from '../hooks/useBugs'
import type { PresenceUser } from '../hooks/usePresence'
import { KIND_LABEL } from '../lib/types'
import type { BugKind, BugWithMeta, WorkspaceMember } from '../lib/types'
import { cn } from '../lib/utils'
import { BugFilters } from './BugFilters'
import type { ClaudeRun } from '../lib/claudeExport'
import { BugRow } from './BugRow'
import { EmptyState } from './EmptyState'
import { GettingStarted } from './GettingStarted'
import { Skeleton } from './Skeleton'

export interface BugListProps {
  bugs: BugWithMeta[]
  workspaceName?: string
  loading: boolean
  /** Status counts for the kind being shown. */
  counts: { open: number; resolved: number; all: number }
  /** Open count per kind, shown on the Bugs / Features switch. */
  openByKind?: Record<BugKind, number>
  filters: Filters
  onFilters: (filters: Filters) => void
  selectedId: string | null
  onSelect: (id: string) => void
  members: WorkspaceMember[]
  /** Signed-in user, listed first as "Me" in the assignee filter. */
  selfId?: string
  viewersOf: (bugId: string) => PresenceUser[]
  highlightIds: Set<string>
  searchRef?: RefObject<HTMLInputElement | null>
  /** Bugs picked for a multi-bug Claude export. */
  pickedIds?: Set<string>
  onTogglePick?: (id: string) => void
  onClearPicked?: () => void
  /** Opens Claude Code on the bugs (or the setup guide when the helper is not connected). */
  onSend?: (bugs: BugWithMeta[]) => void
  /** Copies a ready-to-paste Claude Code prompt for the bugs. */
  onCopy?: (bugs: BugWithMeta[]) => void
  /** Opens the Claude Code setup guide (helper and project folder). */
  onClaudeSetup?: () => void
  onInvite?: () => void
  claudeConnected?: boolean
  /** Latest Claude Code session per bug number, to mark rows Claude is working on. */
  claudeRuns?: Map<number, ClaudeRun>
}

export function BugList({
  bugs,
  workspaceName,
  loading,
  counts,
  openByKind,
  filters,
  onFilters,
  selectedId,
  onSelect,
  members,
  selfId,
  viewersOf,
  highlightIds,
  searchRef,
  pickedIds,
  onTogglePick,
  onClearPicked,
  onSend,
  onCopy,
  onClaudeSetup,
  onInvite,
  claudeConnected = false,
  claudeRuns,
}: BugListProps) {
  const { workspaceId } = useParams<{ workspaceId: string }>()
  const visible = filterBugs(bugs, filters)
  const picked = pickedIds ? bugs.filter((b) => pickedIds.has(b.id)) : []
  const exportable = picked.length > 0 ? picked : visible.filter((b) => !b.optimistic)
  const items = filters.kind === 'feature' ? 'features' : 'bugs'
  const filtered = Boolean(
    filters.query.trim() || filters.filedBy || filters.resolvedBy || filters.severity,
  )

  return (
    <section aria-label="Bug list" className="flex h-full min-h-0 flex-col bg-bg text-fg">
      <div className="space-y-3 border-b border-border p-3">
        <div
          role="tablist"
          aria-label="Bugs or features"
          className="grid grid-cols-2 gap-1 rounded-lg bg-bg-subtle p-1"
        >
          {(['bug', 'feature'] as const).map((kind) => {
            const Icon = kind === 'bug' ? Bug : Lightbulb
            const active = filters.kind === kind
            return (
              <button
                key={kind}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => {
                  if (!active) onFilters({ ...filters, kind })
                }}
                className={cn(
                  't flex items-center justify-center gap-2 rounded-md px-3 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
                  active ? 'bg-bg text-fg shadow-sm' : 'text-muted hover:text-fg',
                )}
              >
                <Icon size={14} aria-hidden="true" />
                {KIND_LABEL[kind].many}
                {openByKind && (
                  <span className="font-mono text-xs text-muted">{openByKind[kind]}</span>
                )}
              </button>
            )
          })}
        </div>
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
          {onSend && exportable.length > 0 && (
            <div className="ml-auto flex items-center gap-1">
              {picked.length > 0 && onClearPicked && (
                <button
                  type="button"
                  onClick={onClearPicked}
                  aria-label={`Clear picked ${items}`}
                  title={`Clear picked ${items}`}
                  className="t rounded-md p-1.5 text-muted hover:bg-bg-subtle hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                >
                  <X size={14} aria-hidden="true" />
                </button>
              )}
              <button
                type="button"
                onClick={() => onSend(exportable)}
                title={
                  picked.length > 0
                    ? `Open Claude Code on the picked ${items} (C)`
                    : `Open Claude Code on every ${KIND_LABEL[filters.kind].one.toLowerCase()} in this view. ⌘/Ctrl-click or press X to pick specific ${items}.`
                }
                className="t inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs text-muted hover:bg-bg-subtle hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                <Bot size={14} aria-hidden="true" />
                {picked.length > 0
                  ? `Send ${picked.length} to Claude`
                  : `Send all ${exportable.length} to Claude`}
              </button>
              {onCopy && (
                <button
                  type="button"
                  onClick={() => onCopy(exportable)}
                  aria-label={
                    picked.length > 0
                      ? `Copy picked ${items} for Claude`
                      : `Copy all ${items} for Claude`
                  }
                  title="Copy a prompt to paste into Claude Code"
                  className="t rounded-md p-1.5 text-muted hover:bg-bg-subtle hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                >
                  <Copy size={14} aria-hidden="true" />
                </button>
              )}
              {onClaudeSetup && claudeConnected && (
                <button
                  type="button"
                  onClick={onClaudeSetup}
                  aria-label="Claude Code project folder"
                  title="Claude Code: change this workspace's project folder"
                  className="t rounded-md p-1.5 text-muted hover:bg-bg-subtle hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                >
                  <FolderCog size={14} aria-hidden="true" />
                </button>
              )}
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
            aria-label={`Search ${items}`}
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
        <BugFilters
          filters={filters}
          onFilters={onFilters}
          members={members}
          selfId={selfId}
          bugs={visible}
          workspaceName={workspaceName}
        />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto" aria-busy={loading}>
        {!loading && workspaceId && (
          <GettingStarted
            workspaceId={workspaceId}
            steps={{
              filed: bugs.some((b) => !b.optimistic),
              invited: members.length > 1,
              claude: !!claudeConnected,
              resolved: bugs.some((b) => b.status === 'resolved'),
            }}
            onInvite={onInvite}
            onClaudeSetup={onClaudeSetup}
          />
        )}
        {loading ? (
          <Skeleton />
        ) : visible.length === 0 ? (
          <EmptyState
            kind={filters.kind}
            tab={filters.tab}
            filtered={filtered}
            hasItems={counts.all > 0}
            onClearFilters={() =>
              onFilters({ ...filters, query: '', filedBy: null, resolvedBy: null, severity: null })
            }
          />
        ) : (
          <div role="listbox" aria-label={KIND_LABEL[filters.kind].many} className="space-y-1 p-2">
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
                claudeState={bug.optimistic ? undefined : claudeRuns?.get(bug.number)?.state}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
