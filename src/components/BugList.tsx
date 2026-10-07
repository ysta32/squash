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
  error?: string | null
  onRetry?: () => void
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

const countPill =
  'inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-fg/[0.06] px-1 text-[11px] font-medium tabular-nums leading-none text-muted'

export function BugList({
  bugs,
  workspaceName,
  loading,
  error,
  onRetry,
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
    filters.query.trim() ||
    filters.filedBy ||
    filters.resolvedBy ||
    filters.assignee ||
    filters.severity,
  )
  const sendLabel =
    picked.length > 0
      ? `Send ${picked.length} to Claude`
      : `Send all ${exportable.length} to Claude`
  const iconButton =
    't focus-ring inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted hover:bg-bg-subtle hover:text-fg'

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
                  't flex h-7 items-center justify-center gap-2 rounded-md px-3 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
                  active ? 'bg-bg text-fg shadow-sm' : 'text-muted hover:text-fg',
                )}
              >
                <Icon size={14} aria-hidden="true" />
                {KIND_LABEL[kind].many}
                {openByKind && <span className={countPill}>{openByKind[kind]}</span>}
              </button>
            )
          })}
        </div>
        <div role="group" aria-label="Bug status" className="flex items-center gap-1">
          {(['open', 'resolved', 'all'] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              aria-pressed={filters.tab === tab}
              onClick={() => onFilters({ ...filters, tab })}
              className={cn(
                't flex h-7 shrink-0 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
                filters.tab === tab
                  ? 'bg-bg-subtle text-fg'
                  : 'text-muted hover:bg-bg-subtle hover:text-fg',
              )}
            >
              {tab === 'open' ? 'Open' : tab === 'resolved' ? 'Resolved' : 'All'}{' '}
              <span className={countPill}>{counts[tab]}</span>
            </button>
          ))}
          {onSend && exportable.length > 0 && (
            <div className="ml-auto flex min-w-0 items-center gap-0.5">
              {picked.length > 0 && onClearPicked && (
                <button
                  type="button"
                  onClick={onClearPicked}
                  aria-label={`Clear picked ${items}`}
                  title={`Clear picked ${items}`}
                  className={iconButton}
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
                aria-label={sendLabel}
                className="t focus-ring inline-flex h-7 shrink-0 items-center justify-center gap-1.5 rounded-md px-1.5 text-xs font-medium text-muted hover:bg-bg-subtle hover:text-fg sm:px-2"
              >
                <Bot size={14} aria-hidden="true" />
                <span aria-hidden="true" className="hidden sm:inline">
                  {sendLabel}
                </span>
                {picked.length > 0 && (
                  <span
                    aria-hidden="true"
                    className={cn(countPill, 'bg-accent/15 text-accent sm:hidden')}
                  >
                    {picked.length}
                  </span>
                )}
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
                  className={iconButton}
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
                  className={iconButton}
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
            className="t focus-ring h-9 w-full rounded-md border border-border bg-bg pl-8 pr-3 text-sm text-fg placeholder:text-muted hover:border-fg/20"
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
        {!loading && !error && workspaceId && (
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
        {!loading && error && bugs.length > 0 && (
          <div
            role="status"
            className="flex items-center justify-between gap-3 px-3 py-2 text-xs text-muted"
          >
            <p>Couldn't refresh — showing saved results</p>
            <button
              type="button"
              onClick={onRetry}
              className="focus-ring shrink-0 rounded-md px-2 py-1 text-accent hover:bg-bg-subtle"
            >
              Retry
            </button>
          </div>
        )}
        {loading ? (
          <Skeleton />
        ) : error && bugs.length === 0 ? (
          <div role="alert" className="space-y-3 p-6 text-center">
            <p className="text-sm text-fg">{error}</p>
            <button
              type="button"
              onClick={onRetry}
              className="focus-ring rounded-md px-3 py-2 text-sm text-accent hover:bg-bg-subtle"
            >
              Retry
            </button>
          </div>
        ) : visible.length === 0 ? (
          <EmptyState
            kind={filters.kind}
            tab={filters.tab}
            filtered={filtered}
            hasItems={counts.all > 0}
            onClearFilters={() =>
              onFilters({
                ...filters,
                query: '',
                filedBy: null,
                resolvedBy: null,
                assignee: null,
                severity: null,
              })
            }
          />
        ) : (
          <div
            role="listbox"
            aria-label={KIND_LABEL[filters.kind].many}
            className="space-y-px p-1.5"
          >
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
