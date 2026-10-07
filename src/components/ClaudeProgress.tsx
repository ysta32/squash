import { useEffect, useState } from 'react'
import { ChevronRight } from 'lucide-react'
import type { ClaudeRun, ClaudeRunState } from '../lib/claudeExport'
import { cn, relativeTime } from '../lib/utils'

const STATE_LABEL: Record<ClaudeRunState, string> = {
  starting: 'Starting Claude Code…',
  working: 'Claude is working',
  waiting: 'Claude needs you in Terminal',
  done: 'Claude finished',
  ended: 'Claude session closed',
}

/**
 * The Claude Code mark: a 4-point spark drawn on the 16px icon grid at 1.5 stroke. Deliberately
 * not Anthropic's logo; always paired with the words "Claude Code".
 */
export function SparkMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinejoin="round"
      className={cn('h-4 w-4 shrink-0', className)}
    >
      <path d="M8 1.75C8.45 5.3 10.7 7.55 14.25 8 10.7 8.45 8.45 10.7 8 14.25 7.55 10.7 5.3 8.45 1.75 8 5.3 7.55 7.55 5.3 8 1.75Z" />
    </svg>
  )
}

export type StatusGlyphKind = 'open' | 'progress' | 'done' | 'working' | 'attention'

/**
 * Status glyphs from the Specimen icon set: hollow ring (open / to do), half-filled ring (in
 * progress), ring with a check (done). `working` is the one permitted spinner: a dashed ring that
 * rotates (static under reduced motion). `attention` is a filled dot for "needs you".
 */
export function StatusGlyph({ kind, className }: { kind: StatusGlyphKind; className?: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn(
        'h-4 w-4 shrink-0',
        kind === 'working' &&
          'animate-spin [animation-duration:1.2s] [animation-timing-function:linear]',
        className,
      )}
    >
      {kind === 'working' ? (
        <circle cx="8" cy="8" r="5.25" strokeDasharray="3 2.5" />
      ) : kind === 'attention' ? (
        <>
          <circle cx="8" cy="8" r="5.25" />
          <circle cx="8" cy="8" r="2.25" fill="currentColor" stroke="none" />
        </>
      ) : (
        <>
          <circle cx="8" cy="8" r="5.25" />
          {kind === 'progress' && (
            <path d="M8 2.75a5.25 5.25 0 0 1 0 10.5Z" fill="currentColor" stroke="none" />
          )}
          {kind === 'done' && <path d="m5.6 8.2 1.7 1.7 3.2-3.6" />}
        </>
      )}
    </svg>
  )
}

const STATE_GLYPH: Record<ClaudeRunState, { kind: StatusGlyphKind; tone: string }> = {
  starting: { kind: 'working', tone: 'text-ink-3' },
  working: { kind: 'working', tone: 'text-status-progress' },
  waiting: { kind: 'attention', tone: 'text-warning' },
  done: { kind: 'done', tone: 'text-status-resolved' },
  ended: { kind: 'open', tone: 'text-ink-3' },
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

function elapsed(fromIso: string, to: Date): string {
  const s = Math.max(0, Math.round((to.getTime() - new Date(fromIso).getTime()) / 1000))
  if (s < 60) return `${s}s`
  if (s < 3600) return `${Math.floor(s / 60)}m ${s % 60}s`
  return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`
}

const TODO_GLYPH = {
  completed: { kind: 'done', tone: 'text-status-resolved', label: 'Done' },
  in_progress: { kind: 'progress', tone: 'text-status-progress', label: 'Doing' },
  pending: { kind: 'open', tone: 'text-ink-3', label: 'To do' },
} as const

/** Live view of the Claude Code session working on this bug, fed by the local bridge. */
export function ClaudeProgress({ run }: { run: ClaudeRun }) {
  const live = run.state === 'starting' || run.state === 'working' || run.state === 'waiting'
  const now = useNow(live)
  const others = run.bugs.length > 1 ? run.bugs.length - 1 : 0
  const waiting = run.state === 'waiting'
  const glyph = STATE_GLYPH[run.state]
  const duration = elapsed(run.startedAt, live ? now : new Date(run.updatedAt))

  return (
    <section
      aria-label="Claude progress"
      aria-live="polite"
      className={cn(
        'min-w-0 rounded-lg border bg-surface-1',
        waiting ? 'border-warning' : 'border-line-2',
      )}
    >
      <header className="flex min-w-0 items-center gap-2 border-b border-line px-4 py-2.5">
        <SparkMark className="text-accent" />
        <p className="specimen-label min-w-0 truncate">
          Claude Code · {duration} · {run.stepCount} {run.stepCount === 1 ? 'step' : 'steps'}
        </p>
        {!live && (
          <time
            dateTime={run.updatedAt}
            title={new Date(run.updatedAt).toLocaleString()}
            className="ml-auto shrink-0 font-mono text-xs text-ink-3"
          >
            {relativeTime(run.updatedAt, now)}
          </time>
        )}
      </header>

      <div className="space-y-4 px-4 py-4">
        <div className={cn(waiting && 'border-l-2 border-warning pl-3')}>
          <p className="flex min-w-0 items-center gap-2 text-base font-medium">
            <StatusGlyph kind={glyph.kind} className={glyph.tone} />
            <span className={cn('min-w-0', waiting ? 'text-warning' : 'text-ink')}>
              {STATE_LABEL[run.state]}
            </span>
          </p>
          {waiting && (
            <p className="mt-1 text-sm text-ink-2">
              Approve or answer it in the terminal running Claude Code. This panel picks up again
              after.
            </p>
          )}
          {others > 0 && (
            <p className="mt-1 text-xs text-ink-3">
              Sent together with {others} other {others === 1 ? 'item' : 'items'}
            </p>
          )}
        </div>

        {run.activity && (
          <p
            className="flex min-w-0 items-baseline gap-2 rounded-md bg-surface-3 px-3 py-2 font-mono text-xs text-ink"
            title={run.activity}
          >
            <span aria-hidden="true" className="shrink-0 text-ink-3">
              ›
            </span>
            <span className="min-w-0 truncate">{run.activity}</span>
          </p>
        )}

        {run.todos && run.todos.length > 0 && (
          <ul aria-label="Claude's plan" className="space-y-1.5 text-sm">
            {run.todos.map((todo, i) => {
              const g = TODO_GLYPH[todo.status]
              return (
                <li key={i} className="flex min-w-0 items-start gap-2.5">
                  <span role="img" aria-label={g.label} className="mt-0.5 inline-flex">
                    <StatusGlyph kind={g.kind} className={g.tone} />
                  </span>
                  <span
                    className={cn(
                      'min-w-0 [overflow-wrap:anywhere]',
                      todo.status === 'in_progress' ? 'font-medium text-ink' : 'text-ink-2',
                    )}
                  >
                    {todo.text}
                  </span>
                </li>
              )
            })}
          </ul>
        )}

        {run.message && (
          <p className="max-w-[68ch] text-read [overflow-wrap:anywhere] whitespace-pre-wrap text-ink">
            {run.message}
          </p>
        )}

        {run.steps.length > 0 && (
          <details className="group text-xs text-ink-3">
            <summary className="t focus-ring flex w-fit cursor-pointer list-none items-center gap-1 rounded-sm select-none hover:text-ink [&::-webkit-details-marker]:hidden">
              <ChevronRight
                size={14}
                strokeWidth={1.5}
                absoluteStrokeWidth
                aria-hidden="true"
                className="t group-open:rotate-90"
              />
              <span className="specimen-label text-inherit">Recent steps</span>
            </summary>
            <ol className="mt-2 space-y-1 border-l border-line pl-4">
              {run.steps.map((step, i) => (
                <li key={i} className="flex min-w-0 gap-3">
                  <time dateTime={step.t} className="shrink-0 font-mono">
                    {new Date(step.t).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                    })}
                  </time>
                  <span className="min-w-0 truncate text-ink-2" title={step.text}>
                    {step.text}
                  </span>
                </li>
              ))}
            </ol>
          </details>
        )}
      </div>
    </section>
  )
}
