import { Activity } from 'lucide-react'
import { useNow } from '../hooks/useNow'
import { isRunActive, type ClaudeRun } from '../lib/claudeExport'
import { STATE_GLYPH, STATE_LABEL, elapsed, orderRuns } from '../lib/claudeRunView'
import { KIND_LABEL } from '../lib/types'
import type { BugWithMeta } from '../lib/types'
import { cn, relativeTime } from '../lib/utils'
import { StatusGlyph } from './ClaudeProgress'
import { StatePanel } from './EmptyState'
import { KIND_ICON } from './kindIcon'
import { Button } from './ui'

export interface RunningListProps {
  /** Every recent Claude run in the workspace, across bugs, features and tests. */
  runs: ClaudeRun[]
  /** All loaded items, to name each run's bugs, features and tests. */
  bugs: BugWithMeta[]
  /** Number of the item open in the detail pane, to mark its run. */
  selectedNumber: number | null
  onOpen: (number: number) => void
  claudeConnected: boolean
  onClaudeSetup?: () => void
}

/** One Claude Code run: its items, what Claude is doing now, and its summary once it finishes. */
function RunCard({
  run,
  bugs,
  selectedNumber,
  onOpen,
  now,
}: {
  run: ClaudeRun
  bugs: Map<number, BugWithMeta>
  selectedNumber: number | null
  onOpen: (number: number) => void
  now: Date
}) {
  const live = isRunActive(run)
  const glyph = STATE_GLYPH[run.state]
  const waiting = run.state === 'waiting'
  const todos = run.todos ?? []
  const doneTodos = todos.filter((t) => t.status === 'completed').length
  const current = todos.find((t) => t.status === 'in_progress')
  const selected = selectedNumber !== null && run.bugs.includes(selectedNumber)

  return (
    <li
      aria-label={`${STATE_LABEL[run.state]}: ${run.bugs.map((n) => `#${n}`).join(', ')}`}
      className={cn(
        'border-b border-line px-4 py-3',
        selected && 'bg-surface-2',
        waiting && 'border-l-2 border-l-warning',
      )}
    >
      <p className="flex min-w-0 items-center gap-2 text-sm font-medium">
        <StatusGlyph kind={glyph.kind} className={glyph.tone} />
        <span className={cn('min-w-0 truncate', waiting ? 'text-warning' : 'text-ink')}>
          {STATE_LABEL[run.state]}
        </span>
        <span className="ml-auto shrink-0 font-mono text-xs font-normal text-ink-3">
          {live ? (
            elapsed(run.startedAt, now)
          ) : (
            <time dateTime={run.updatedAt} title={new Date(run.updatedAt).toLocaleString()}>
              {relativeTime(run.updatedAt, now)}
            </time>
          )}
        </span>
      </p>

      <ul className="mt-2 space-y-0.5">
        {run.bugs.map((n) => {
          const bug = bugs.get(n)
          const Icon = bug ? KIND_ICON[bug.kind] : null
          return (
            <li key={n}>
              <button
                type="button"
                onClick={() => onOpen(n)}
                aria-current={n === selectedNumber ? 'true' : undefined}
                title={bug ? `Open ${KIND_LABEL[bug.kind].one.toLowerCase()} #${n}` : `Open #${n}`}
                className="t focus-ring -mx-1.5 flex w-[calc(100%+0.75rem)] min-w-0 items-center gap-2 rounded-sm px-1.5 py-1 text-left text-sm text-ink-2 hover:bg-surface-3 hover:text-ink pointer-coarse:min-h-11"
              >
                {Icon && (
                  <Icon size={14} strokeWidth={1.5} aria-hidden="true" className="shrink-0" />
                )}
                <span className="shrink-0 font-mono text-xs text-ink-3">#{n}</span>
                <span className="min-w-0 truncate">{bug?.title ?? 'Not loaded'}</span>
              </button>
            </li>
          )
        })}
      </ul>

      {live && run.activity && (
        <p
          className="mt-2 flex min-w-0 items-baseline gap-2 rounded-md bg-surface-3 px-2.5 py-1.5 font-mono text-xs text-ink"
          title={run.activity}
        >
          <span aria-hidden="true" className="shrink-0 text-ink-3">
            ›
          </span>
          <span className="min-w-0 truncate">{run.activity}</span>
        </p>
      )}

      {live && todos.length > 0 && (
        <p className="mt-2 min-w-0 truncate text-xs text-ink-3">
          {doneTodos} of {todos.length} done{current ? ` · ${current.text}` : ''}
        </p>
      )}

      {!live && run.message && (
        <div className="mt-2">
          <p className="specimen-label">Summary</p>
          <p className="mt-1 line-clamp-6 text-sm [overflow-wrap:anywhere] text-pretty whitespace-pre-wrap text-ink-2">
            {run.message}
          </p>
        </div>
      )}
    </li>
  )
}

/**
 * The Running view: every Claude Code run in the workspace at once (bugs, features and tests
 * alike), live while Claude works and with Claude's summary once a run finishes.
 */
export function RunningList({
  runs,
  bugs,
  selectedNumber,
  onOpen,
  claudeConnected,
  onClaudeSetup,
}: RunningListProps) {
  const ordered = orderRuns(runs)
  const now = useNow(ordered.some(isRunActive))
  const byNumber = new Map(bugs.filter((b) => !b.optimistic).map((b) => [b.number, b]))

  if (ordered.length === 0) {
    return (
      <StatePanel
        role="status"
        icon={Activity}
        title="Nothing running"
        body={
          claudeConnected
            ? 'Send a bug, feature request or test to Claude Code and it shows up here while Claude works, with a summary when it finishes.'
            : 'Set up Claude Code to send items to it. Every run then shows up here while Claude works, with a summary when it finishes.'
        }
        action={
          !claudeConnected && onClaudeSetup ? (
            <Button variant="secondary" size="sm" onClick={onClaudeSetup}>
              Set up Claude Code
            </Button>
          ) : undefined
        }
      />
    )
  }

  return (
    <ul aria-label="Claude Code runs">
      {ordered.map((run) => (
        <RunCard
          key={run.id}
          run={run}
          bugs={byNumber}
          selectedNumber={selectedNumber}
          onOpen={onOpen}
          now={now}
        />
      ))}
    </ul>
  )
}
