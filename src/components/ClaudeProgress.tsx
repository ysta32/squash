import { useEffect, useState } from 'react'
import { Bot, Check, Circle, CircleDot } from 'lucide-react'
import type { ClaudeRun, ClaudeRunState } from '../lib/claudeExport'
import { cn, relativeTime } from '../lib/utils'

const STATE_LABEL: Record<ClaudeRunState, string> = {
  starting: 'Starting Claude Code…',
  working: 'Claude is working',
  waiting: 'Claude needs you in Terminal',
  done: 'Claude finished',
  ended: 'Claude session closed',
}

const STATE_DOT: Record<ClaudeRunState, string> = {
  starting: 'animate-pulse bg-muted/60',
  working: 'animate-pulse bg-accent',
  waiting: 'animate-pulse bg-warning',
  done: 'bg-success',
  ended: 'bg-muted/60',
}

/** Re-renders every few seconds so "updated 12s ago" stays current while Claude works. */
function useNow(live: boolean): Date {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    if (!live) return
    const timer = setInterval(() => setNow(new Date()), 5000)
    return () => clearInterval(timer)
  }, [live])
  return now
}

function elapsed(fromIso: string, now: Date): string {
  const s = Math.max(0, Math.round((now.getTime() - new Date(fromIso).getTime()) / 1000))
  if (s < 60) return `${s}s`
  if (s < 3600) return `${Math.floor(s / 60)}m ${s % 60}s`
  return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`
}

/** Live view of the Claude Code session working on this bug, fed by the local bridge. */
export function ClaudeProgress({ run }: { run: ClaudeRun }) {
  const live = run.state === 'starting' || run.state === 'working' || run.state === 'waiting'
  const now = useNow(live)
  const others = run.bugs.length > 1 ? run.bugs.length - 1 : 0

  return (
    <section
      aria-label="Claude progress"
      aria-live="polite"
      className="min-w-0 rounded-lg border border-border bg-bg-subtle/50 p-4 text-sm"
    >
      <div className="flex items-center gap-2">
        <Bot className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
        <span className={cn('h-2 w-2 shrink-0 rounded-full', STATE_DOT[run.state])} />
        <span className="min-w-0 truncate font-medium">{STATE_LABEL[run.state]}</span>
        <span className="ml-auto shrink-0 text-xs text-muted tabular-nums">
          {live ? (
            <>
              {elapsed(run.startedAt, now)} · {run.stepCount} steps
            </>
          ) : (
            <time dateTime={run.updatedAt} title={new Date(run.updatedAt).toLocaleString()}>
              {relativeTime(run.updatedAt, now)}
            </time>
          )}
        </span>
      </div>
      {others > 0 && (
        <p className="mt-1 text-xs text-muted">
          Sent together with {others} other {others === 1 ? 'item' : 'items'}
        </p>
      )}

      {run.activity && (
        <p
          className="mt-3 min-w-0 truncate rounded-md border border-border bg-bg px-2.5 py-1.5 font-mono text-xs text-fg"
          title={run.activity}
        >
          {run.activity}
        </p>
      )}

      {run.todos && run.todos.length > 0 && (
        <ul aria-label="Claude's plan" className="mt-3 space-y-1 text-xs">
          {run.todos.map((todo, i) => (
            <li key={i} className="flex min-w-0 items-start gap-2">
              {todo.status === 'completed' ? (
                <Check className="mt-0.5 h-3 w-3 shrink-0 text-success" aria-label="Done" />
              ) : todo.status === 'in_progress' ? (
                <CircleDot className="mt-0.5 h-3 w-3 shrink-0 text-accent" aria-label="Doing" />
              ) : (
                <Circle className="mt-0.5 h-3 w-3 shrink-0 text-muted" aria-label="To do" />
              )}
              <span
                className={cn(
                  'min-w-0 [overflow-wrap:anywhere]',
                  todo.status === 'completed' && 'text-muted line-through',
                  todo.status === 'in_progress' && 'font-medium',
                )}
              >
                {todo.text}
              </span>
            </li>
          ))}
        </ul>
      )}

      {run.message && (
        <div className="mt-3 max-h-64 overflow-y-auto rounded-md border border-border bg-bg px-3 py-2 text-xs leading-relaxed [overflow-wrap:anywhere] whitespace-pre-wrap">
          {run.message}
        </div>
      )}

      {run.steps.length > 0 && (
        <details className="mt-3 text-xs text-muted">
          <summary className="t focus-ring w-fit cursor-pointer rounded-md select-none hover:text-fg">
            Recent steps
          </summary>
          <ol className="mt-1 space-y-0.5">
            {run.steps.map((step, i) => (
              <li key={i} className="flex min-w-0 gap-2">
                <time dateTime={step.t} className="shrink-0 font-mono tabular-nums">
                  {new Date(step.t).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                  })}
                </time>
                <span className="min-w-0 truncate" title={step.text}>
                  {step.text}
                </span>
              </li>
            ))}
          </ol>
        </details>
      )}
    </section>
  )
}
