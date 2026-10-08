import { useLayoutEffect, useRef, useState } from 'react'
import type { KeyboardEvent as ReactKeyboardEvent, RefObject } from 'react'
import { useParams } from 'react-router-dom'
import { AlertTriangle, Copy, FolderCog, Search, Sparkle, X } from 'lucide-react'
import { filterBugs, hasActiveFilters } from '../hooks/useBugs'
import type { BugFilters as Filters } from '../hooks/useBugs'
import type { PresenceUser } from '../hooks/usePresence'
import { KINDS, KIND_LABEL } from '../lib/types'
import type { BugKind, BugWithMeta, WorkspaceMember } from '../lib/types'
import { cn } from '../lib/utils'
import { ActiveFilters, BugFilters, Count, StatusMenu } from './BugFilters'
import type { ListAction } from './BugFilters'
import type { ClaudeRun } from '../lib/claudeExport'
import { BugRow } from './BugRow'
import { EmptyState, StatePanel } from './EmptyState'
import { Tooltip } from './Tooltip'
import { Button, Kbd } from './ui'
import { GettingStarted, Onboarding } from './GettingStarted'
import { isFirstItemView, onboardingSteps } from '../lib/onboarding'
import { Skeleton } from './Skeleton'
import { BulkBar } from './BulkBar'
import type { BulkBarProps } from './BulkBar'

export interface BugListProps {
  bugs: BugWithMeta[]
  workspaceName?: string
  loading: boolean
  error?: string | null
  onRetry?: () => void
  /** Status counts for the kind being shown. */
  counts: { open: number; resolved: number; all: number }
  /** Open count per kind, shown on the Bugs / Features / Tests switch. */
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
  /** Bugs picked for bulk actions and a multi-bug Claude export. */
  pickedIds?: Set<string>
  onTogglePick?: (id: string) => void
  onClearPicked?: () => void
  onResolve?: BulkBarProps['onResolve']
  onReopen?: BulkBarProps['onReopen']
  onAssign?: BulkBarProps['onAssign']
  /** Checks a bug off (or reopens it) from the circle at the start of its row. */
  onToggleStatus?: (bug: BugWithMeta) => void
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
  /**
   * The detail pane beside the list shows the onboarding for an empty kind (desktop), so the list
   * keeps only a quiet line instead of repeating it.
   */
  onboardingInDetail?: boolean
}

/** Bugs / Features / Tests as underline tabs: one 2px accent bar that slides between them. */
function KindTabs({
  kind,
  openByKind,
  countsPending = false,
  onChange,
}: {
  kind: BugKind
  openByKind?: Record<BugKind, number>
  /** Counts are not known yet (first load): keep their space but show nothing. */
  countsPending?: boolean
  onChange: (kind: BugKind) => void
}) {
  const listRef = useRef<HTMLDivElement>(null)
  const [bar, setBar] = useState<{ left: number; width: number } | null>(null)
  const [settled, setSettled] = useState(false)

  useLayoutEffect(() => {
    const list = listRef.current
    if (!list) return
    const measure = () => {
      const tab = list.querySelector<HTMLElement>('[aria-selected="true"]')
      if (!tab || tab.offsetWidth === 0) return
      setBar({ left: tab.offsetLeft, width: tab.offsetWidth })
    }
    measure()
    if (typeof ResizeObserver !== 'function') return
    const observer = new ResizeObserver(measure)
    observer.observe(list)
    return () => observer.disconnect()
  }, [kind, openByKind])

  // The first placement jumps into position; later tab changes slide.
  useLayoutEffect(() => {
    if (bar && !settled) {
      const frame = requestAnimationFrame(() => setSettled(true))
      return () => cancelAnimationFrame(frame)
    }
  }, [bar, settled])

  const kinds = KINDS
  function onKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
    event.preventDefault()
    const index = kinds.indexOf(kind)
    const next =
      event.key === 'Home'
        ? 0
        : event.key === 'End'
          ? kinds.length - 1
          : (index + (event.key === 'ArrowRight' ? 1 : -1) + kinds.length) % kinds.length
    onChange(kinds[next])
    listRef.current?.querySelectorAll<HTMLElement>('[role="tab"]')[next]?.focus()
  }

  return (
    <div
      ref={listRef}
      role="tablist"
      aria-label="Bugs, features or tests"
      onKeyDown={onKeyDown}
      className="relative flex h-full shrink-0 items-stretch gap-5"
    >
      {kinds.map((k) => {
        const active = kind === k
        return (
          <button
            key={k}
            type="button"
            role="tab"
            aria-selected={active}
            tabIndex={active ? 0 : -1}
            onClick={() => {
              if (!active) onChange(k)
            }}
            className={cn(
              't focus-ring-inset flex items-center gap-1.5 rounded-xs text-sm font-medium',
              active ? 'text-ink' : 'text-ink-3 hover:text-ink',
            )}
          >
            {KIND_LABEL[k].many}{' '}
            {/* The active kind's count already shows on the status control beside it. */}
            {openByKind && !active && <Count value={openByKind[k]} pending={countsPending} />}
          </button>
        )
      })}
      <span
        aria-hidden="true"
        className={cn(
          'pointer-events-none absolute bottom-[-1px] left-0 h-[2px] w-px origin-left bg-accent',
          settled && 'transition-transform duration-(--dur-standard) ease-(--ease-out)',
          !bar && 'opacity-0',
        )}
        style={bar ? { transform: `translateX(${bar.left}px) scaleX(${bar.width})` } : undefined}
      />
    </div>
  )
}

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
  onResolve,
  onReopen,
  onAssign,
  onToggleStatus,
  onSend,
  onCopy,
  onClaudeSetup,
  onInvite,
  claudeConnected = false,
  claudeRuns,
  onboardingInDetail = false,
}: BugListProps) {
  const { workspaceId } = useParams<{ workspaceId: string }>()
  const searchInput = useRef<HTMLInputElement | null>(null)
  const footerRef = useRef<HTMLDivElement>(null)
  // The footer (send bar or bulk bar) publishes its height as --list-footer-h so toasts in the
  // bottom-left corner rise above it instead of covering it. It measures 0 while the list pane is
  // hidden (the phone detail view) or the footer is empty.
  useLayoutEffect(() => {
    const el = footerRef.current
    const root = document.documentElement
    if (!el) return
    const sync = () => {
      const height = el.getBoundingClientRect().height
      if (height > 0) root.style.setProperty('--list-footer-h', `${height}px`)
      else root.style.removeProperty('--list-footer-h')
    }
    sync()
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(sync)
    observer?.observe(el)
    window.addEventListener('resize', sync)
    return () => {
      observer?.disconnect()
      window.removeEventListener('resize', sync)
      root.style.removeProperty('--list-footer-h')
    }
  }, [])
  const visible = filterBugs(bugs, filters)
  const picked = pickedIds ? bugs.filter((b) => pickedIds.has(b.id)) : []
  const bulkActions = onResolve && onReopen && onAssign && onClearPicked
  const exportable = picked.length > 0 ? picked : visible.filter((b) => !b.optimistic)
  const items = KIND_LABEL[filters.kind].many.toLowerCase()
  const otherFilters = Boolean(
    filters.filedBy || filters.resolvedBy || filters.assignee || filters.severity,
  )
  const filtered = hasActiveFilters(filters)
  const sendLabel = `Send ${exportable.length} to Claude Code`
  // Sending everything in view starts a Claude Code run per bug, so it asks once first; an
  // explicit pick (or a single bug) sends straight away.
  const needsConfirm = picked.length === 0 && exportable.length > 1
  const [confirmSend, setConfirmSend] = useState(false)
  // Leaving the confirm removes the focused button; focus goes back to the send trigger.
  const refocusSend = useRef(false)
  function closeConfirm(): void {
    refocusSend.current = true
    setConfirmSend(false)
  }
  const viewLabel =
    picked.length > 0
      ? `${picked.length} picked`
      : exportable.length !== counts[filters.tab]
        ? `${exportable.length} ${exportable.length === 1 ? KIND_LABEL[filters.kind].one.toLowerCase() : items} in view`
        : ''
  const showBulk = Boolean(bulkActions && picked.length > 0)
  const showSendBar = Boolean(onSend && exportable.length > 0 && !showBulk)

  const actions: ListAction[] = []
  if (onCopy && exportable.length > 0)
    actions.push({
      id: 'copy',
      label: `Copy prompt for ${exportable.length} ${exportable.length === 1 ? KIND_LABEL[filters.kind].one.toLowerCase() : items}`,
      icon: <Copy size={16} strokeWidth={1.5} />,
      onSelect: () => onCopy(exportable),
    })
  if (onClaudeSetup && claudeConnected)
    actions.push({
      id: 'claude-folder',
      label: 'Claude Code folder…',
      icon: <FolderCog size={16} strokeWidth={1.5} />,
      onSelect: onClaudeSetup,
    })

  // On the first load every count is still 0: show blanks rather than a false "0".
  const countsPending = loading && bugs.length === 0 && counts.all === 0
  const steps = onboardingSteps(bugs, members.length, claudeConnected)
  /** Nothing of this kind yet (and nothing hidden by a filter): the list shows how to start. */
  const firstItem = isFirstItemView({
    loading,
    error: error ?? null,
    total: bugs.length,
    kindTotal: counts.all,
    visible: visible.length,
    filtered,
    tab: filters.tab,
  })

  return (
    <section aria-label="Bug list" className="flex h-full min-h-0 flex-col bg-surface-1 text-ink">
      <div className="shrink-0 border-b border-line">
        <div className="flex h-[2.8571rem] items-stretch justify-between gap-3 border-b border-line px-4 pointer-coarse:h-[3.1429rem]">
          <KindTabs
            kind={filters.kind}
            openByKind={openByKind}
            countsPending={countsPending}
            onChange={(kind) => onFilters({ ...filters, kind })}
          />
          {/* Status is a filter, so it is one compact menu at every width, never a second row
              of tabs beside the Bugs / Features / Tests underline. */}
          <StatusMenu
            tab={filters.tab}
            counts={counts}
            countsPending={countsPending}
            onTab={(tab) => onFilters({ ...filters, tab })}
            className="-mr-2 flex shrink-0 items-center"
          />
        </div>
        <div className="flex items-center gap-1 px-4 py-2">
          <div className="relative min-w-0 flex-1">
            <Search
              size={14}
              strokeWidth={1.5}
              aria-hidden="true"
              className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-ink-3"
            />
            <input
              ref={(node) => {
                searchInput.current = node
                if (searchRef) searchRef.current = node
              }}
              type="search"
              aria-label={`Search ${items}`}
              placeholder="Search"
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
              // The browser's own clear button is hidden (off-palette, and the text ran under
              // it); the 24px clear button below replaces it, and the right padding keeps the
              // text clear of it and of the "/" key cap.
              className="peer t focus-ring h-[2.2857rem] w-full rounded-md border border-line-2 bg-surface-2 pr-[36px] pl-8 text-sm text-ink placeholder:text-ink-3 hover:border-line-input focus-visible:border-focus pointer-coarse:h-[3.1429rem] pointer-coarse:text-base [&::-webkit-search-cancel-button]:hidden [&::-webkit-search-cancel-button]:appearance-none"
            />
            {/* The "/" shortcut as a key cap; gone while typing, focused or on touch. */}
            <Kbd className="pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 peer-focus:hidden peer-[:not(:placeholder-shown)]:hidden pointer-coarse:hidden">
              /
            </Kbd>
            {filters.query !== '' && (
              <button
                type="button"
                aria-label="Clear search"
                title="Clear search (Esc)"
                onClick={() => {
                  onFilters({ ...filters, query: '' })
                  searchInput.current?.focus()
                }}
                // 24px to see; on touch an invisible 44px hit area around it.
                className="t focus-ring absolute top-1/2 right-1.5 flex size-[24px] -translate-y-1/2 items-center justify-center rounded-sm text-ink-3 hover:bg-surface-3 hover:text-ink pointer-coarse:after:absolute pointer-coarse:after:-inset-[10px]"
              >
                <X size={14} strokeWidth={1.5} aria-hidden="true" />
              </button>
            )}
          </div>
          <BugFilters
            filters={filters}
            onFilters={onFilters}
            members={members}
            selfId={selfId}
            bugs={visible}
            workspaceName={workspaceName}
            actions={actions}
          />
        </div>
        <ActiveFilters filters={filters} onFilters={onFilters} members={members} selfId={selfId} />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto [scrollbar-gutter:stable]" aria-busy={loading}>
        {!loading && error && bugs.length > 0 && (
          <div
            role="status"
            className="flex h-[2rem] items-center gap-2 border-b border-line bg-surface-3 px-4 text-xs text-ink-2"
          >
            <span aria-hidden="true" className="size-1.5 shrink-0 rounded-full bg-warning" />
            <p className="min-w-0 truncate">Couldn't refresh — showing saved results</p>
            <button
              type="button"
              onClick={onRetry}
              className="focus-ring ml-auto shrink-0 rounded-xs font-medium text-accent underline decoration-accent/40 underline-offset-2 hover:decoration-accent"
            >
              Retry
            </button>
          </div>
        )}
        {/* While nothing is filed anywhere the checklist is the onboarding itself (below). */}
        {!loading && !error && workspaceId && !(firstItem && !steps.filed) && (
          <GettingStarted
            workspaceId={workspaceId}
            steps={steps}
            onInvite={onInvite}
            onClaudeSetup={onClaudeSetup}
          />
        )}
        {loading ? (
          <Skeleton />
        ) : error && bugs.length === 0 ? (
          <StatePanel
            role="alert"
            tone="danger"
            icon={AlertTriangle}
            title={error}
            body="Check your connection, then try again."
            action={
              <Button variant="secondary" size="sm" onClick={onRetry}>
                Retry
              </Button>
            }
          />
        ) : firstItem ? (
          onboardingInDetail ? (
            <p role="status" className="px-4 pt-4 text-sm text-ink-3">
              No {KIND_LABEL[filters.kind].noun}s yet.
            </p>
          ) : (
            <Onboarding
              workspaceId={workspaceId}
              kind={filters.kind}
              tab={filters.tab}
              steps={steps}
              onInvite={onInvite}
              onClaudeSetup={onClaudeSetup}
            />
          )
        ) : visible.length === 0 ? (
          <EmptyState
            kind={filters.kind}
            tab={filters.tab}
            filtered={filtered}
            hasItems={counts.all > 0}
            query={otherFilters ? '' : filters.query}
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
          <div role="listbox" aria-label={KIND_LABEL[filters.kind].many}>
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
                onToggleStatus={onToggleStatus}
              />
            ))}
          </div>
        )}
      </div>
      <div ref={footerRef} className="shrink-0">
        {showBulk && bulkActions && (
          <BulkBar
            bugs={picked}
            members={members}
            selfId={selfId ?? ''}
            onResolve={onResolve}
            onReopen={onReopen}
            onAssign={onAssign}
            onClear={onClearPicked}
            onSend={onSend}
            onCopy={onCopy}
            onClaudeSetup={claudeConnected ? onClaudeSetup : undefined}
          />
        )}
        {showSendBar && onSend && (
          <div
            className="flex h-[2.8571rem] shrink-0 items-center gap-2 border-t border-line bg-surface-1 pr-2 pl-4 pointer-coarse:h-[3.4286rem]"
            onKeyDown={(event) => {
              if (confirmSend && event.key === 'Escape') {
                event.preventDefault()
                event.stopPropagation()
                event.nativeEvent.stopImmediatePropagation()
                closeConfirm()
              }
            }}
          >
            {confirmSend && needsConfirm ? (
              <>
                <p role="status" className="min-w-0 truncate text-sm text-ink-2">
                  Start Claude Code on{' '}
                  <span className="font-mono tabular-nums">{exportable.length}</span> {items}?
                </p>
                <span className="ml-auto flex shrink-0 items-center gap-0.5">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={closeConfirm}
                    className="pointer-coarse:h-[3.1429rem]"
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    autoFocus
                    onClick={() => {
                      closeConfirm()
                      onSend(exportable)
                    }}
                    className="text-ink pointer-coarse:h-[3.1429rem]"
                  >
                    <Sparkle
                      size={14}
                      strokeWidth={1.75}
                      aria-hidden="true"
                      className="text-accent"
                    />
                    Send
                  </Button>
                </span>
              </>
            ) : (
              <>
                <span className="min-w-0 truncate font-mono text-label tracking-[0.06em] text-ink-3 uppercase tabular-nums">
                  {viewLabel}
                </span>
                <span className="ml-auto flex shrink-0 items-center gap-0.5">
                  {picked.length > 0 && onClearPicked && (
                    <Tooltip label={`Clear picked ${items}`} align="end">
                      <button
                        type="button"
                        onClick={onClearPicked}
                        aria-label={`Clear picked ${items}`}
                        className="t focus-ring flex size-[2.2857rem] items-center justify-center rounded-md text-ink-2 hover:bg-surface-3 hover:text-ink pointer-coarse:size-[3.1429rem]"
                      >
                        <X size={16} strokeWidth={1.5} aria-hidden="true" />
                      </button>
                    </Tooltip>
                  )}
                  <Button
                    ref={(node: HTMLButtonElement | null) => {
                      if (node && refocusSend.current) {
                        refocusSend.current = false
                        node.focus()
                      }
                    }}
                    variant="ghost"
                    size="sm"
                    onClick={() => (needsConfirm ? setConfirmSend(true) : onSend(exportable))}
                    aria-label={sendLabel}
                    aria-keyshortcuts={picked.length > 0 ? 'C' : undefined}
                    title={
                      picked.length > 0
                        ? `Open Claude Code on the picked ${items} (C)`
                        : `Open Claude Code on every ${KIND_LABEL[filters.kind].one.toLowerCase()} in this view. ⌘/Ctrl-click or press X to pick specific ${items}.`
                    }
                    className="pointer-coarse:h-[3.1429rem]"
                  >
                    <Sparkle
                      size={14}
                      strokeWidth={1.75}
                      aria-hidden="true"
                      className="text-accent"
                    />
                    {sendLabel}
                    {picked.length > 0 && <Kbd className="ml-0.5">C</Kbd>}
                  </Button>
                </span>
              </>
            )}
          </div>
        )}
      </div>
    </section>
  )
}
