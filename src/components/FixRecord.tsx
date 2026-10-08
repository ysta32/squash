import { Component, Suspense, lazy, useEffect, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { AlertCircle, ArrowUpRight, ChevronRight } from 'lucide-react'
import type { UseFixRunsResult } from '../hooks/useFixRuns'
import {
  FIX_EVIDENCE_LABEL,
  diffCells,
  prLabel,
  shortSha,
  type FixRun,
  type FixRunStatus,
} from '../lib/fixRuns'
import type { BugAttachment } from '../lib/types'
import { cn, relativeTime } from '../lib/utils'
import { StatusGlyph } from './ClaudeProgress'

// Only bugs with an "after" screenshot need the slider, so it loads on demand. A failed chunk
// load is cached by lazy(), so Retry swaps in a fresh lazy component.
const loadBeforeAfter = () => import('./BeforeAfter')
const chunk = { BeforeAfter: lazy(loadBeforeAfter) }

export interface FixRecordProps {
  bugId: string
  /** The bug's runs (useFixRuns), loaded by the detail so its screenshot strip can label "after" shots. */
  fix: UseFixRunsResult
  /** The bug's screenshots, oldest first: the first one is the "before". */
  attachments: BugAttachment[]
}

const STATUS: Record<FixRunStatus, { label: string; tone: string }> = {
  running: { label: 'Running', tone: 'text-status-progress' },
  succeeded: { label: 'Succeeded', tone: 'text-status-resolved' },
  failed: { label: 'Failed', tone: 'text-danger' },
  cancelled: { label: 'Cancelled', tone: 'text-ink-3' },
}

/** A run left no commit when it finished without one (the helper's noCommit, or no sha at all). */
function noCommit(run: FixRun): boolean {
  return run.status !== 'running' && run.commit_sha === null
}

/** Re-renders every 30s while a run is in flight so "started 2m ago" stays current. */
function useNow(live: boolean): Date {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    if (!live) return
    const timer = setInterval(() => setNow(new Date()), 30_000)
    return () => clearInterval(timer)
  }, [live])
  return now
}

/** Frame for the comparison (and its placeholder): the before shot's aspect, portrait capped. */
function frameStyle(before: BugAttachment): CSSProperties {
  const ratio = before.width > 0 && before.height > 0 ? before.width / before.height : 4 / 3
  // Portrait shots would run off the screen at full width: keep them at most ~560px tall.
  return { aspectRatio: String(ratio), maxWidth: `${Math.max(240, Math.round(560 * ratio))}px` }
}

/**
 * Proof of fix (DESIGN.md section 2a #1): the Claude Code runs recorded on this bug. The latest is
 * a specimen label (`FIX · sha · branch`, status, diff, PR, time); earlier ones fold away beneath
 * it. The evidence is self-reported by the local helper, and says so. Renders nothing until the
 * bug has a run, and nothing at all on servers without the fix_runs table.
 */
export function FixRecord({ bugId, fix, attachments }: FixRecordProps) {
  const { runs, available, error } = fix
  const latest = runs[0]
  const now = useNow(runs.some((r) => r.status === 'running'))

  if (!available || (!latest && !error)) return null

  const afterIds = new Set(runs.map((r) => r.after_attachment_id).filter(Boolean))
  const byId = new Map(attachments.map((a) => [a.id, a]))
  const before = attachments.find((a) => !afterIds.has(a.id))
  const proof = runs.find((r) => r.after_attachment_id && byId.has(r.after_attachment_id))
  const after = proof?.after_attachment_id ? byId.get(proof.after_attachment_id) : undefined
  const earlier = runs.slice(1)
  const headingId = `fix-record-${bugId}`

  return (
    <section aria-labelledby={headingId} className="min-w-0">
      <h2 id={headingId} className="specimen-label mb-3 text-ink-3">
        Fix record
      </h2>

      {error && (
        <p role="alert" className="mb-3 flex items-start gap-2 text-sm text-danger">
          <AlertCircle
            size={16}
            strokeWidth={1.5}
            absoluteStrokeWidth
            aria-hidden="true"
            className="mt-0.5 shrink-0"
          />
          <span className="min-w-0 [overflow-wrap:anywhere]">
            Couldn't load fix runs: {error}. They reload when the connection comes back.
          </span>
        </p>
      )}

      {latest && (
        <>
          <FixLabel run={latest} now={now} />
          <p className="mt-2 text-xs text-ink-3">{FIX_EVIDENCE_LABEL}</p>

          {latest.summary && (
            <p
              title={latest.summary}
              className="mt-4 line-clamp-4 max-w-[68ch] text-sm [overflow-wrap:anywhere] whitespace-pre-wrap text-ink-2"
            >
              {latest.summary}
            </p>
          )}

          {before && after && proof && (
            <figure className="mt-6 min-w-0">
              <Comparison
                before={before}
                after={after}
                frameStyle={frameStyle(before)}
                label={`Before and after ${runName(proof)}`}
                figures={[attachments.indexOf(before) + 1, attachments.indexOf(after) + 1]}
              />
              <figcaption
                className="specimen-label mt-2 flex items-center justify-between gap-2 text-ink-3"
                style={{ maxWidth: frameStyle(before).maxWidth }}
              >
                <span>Before · Fig. {attachments.indexOf(before) + 1}</span>
                <span>
                  After · <span className="normal-case">{runName(proof)}</span>
                </span>
              </figcaption>
            </figure>
          )}

          {earlier.length > 0 && <EarlierRuns runs={earlier} now={now} />}
        </>
      )}
    </section>
  )
}

/** Catches a failed load of the comparison chunk so it never reaches the route's boundary. */
class ChunkBoundary extends Component<
  { fallback: ReactNode; children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children
  }
}

/** The lazily loaded slider, with a skeleton while it loads and an inline error if it can't. */
function Comparison({
  figures,
  ...props
}: {
  before: BugAttachment
  after: BugAttachment
  frameStyle: CSSProperties
  label: string
  /** Figure numbers of the before and after shots in the Screenshots strip. */
  figures: [number, number]
}) {
  const [attempt, setAttempt] = useState(0)
  const retry = () => {
    chunk.BeforeAfter = lazy(loadBeforeAfter)
    setAttempt((a) => a + 1)
  }
  const View = chunk.BeforeAfter
  return (
    <ChunkBoundary
      key={attempt}
      fallback={
        <div
          role="alert"
          style={{ maxWidth: props.frameStyle.maxWidth }}
          className="flex w-full flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-line-2 bg-surface-1 px-4 py-3 text-sm text-danger"
        >
          <AlertCircle size={16} strokeWidth={1.5} absoluteStrokeWidth aria-hidden="true" />
          <span className="min-w-0">
            Couldn't load the comparison. Fig. {figures[0]} and Fig. {figures[1]} are in Screenshots
            above.
          </span>
          <button
            type="button"
            onClick={retry}
            className="t focus-ring rounded-sm font-medium text-ink underline decoration-line-input underline-offset-2 hover:decoration-ink pointer-coarse:min-h-11"
          >
            Retry
          </button>
        </div>
      }
    >
      <Suspense
        fallback={
          <div
            style={props.frameStyle}
            className="w-full animate-skeleton rounded-lg bg-surface-3"
          />
        }
      >
        <View {...props} />
      </Suspense>
    </ChunkBoundary>
  )
}

/** "fix e3f9a12", or "the run" with no commit. */
function runName(run: FixRun): string {
  return run.commit_sha ? `fix ${shortSha(run.commit_sha)}` : 'the run'
}

const SEP = (
  <span aria-hidden="true" className="text-ink-3">
    {' · '}
  </span>
)

/** The latest run as a specimen label: identity and status on top, the evidence under a hairline. */
function FixLabel({ run, now }: { run: FixRun; now: Date }) {
  const status = STATUS[run.status]
  const running = run.status === 'running'
  const when = running ? run.started_at : (run.finished_at ?? run.started_at)

  return (
    <div className="specimen-label w-full min-w-0 rounded-xs border border-line-2 bg-surface-1 text-ink-2">
      <div className="relative flex min-w-0 items-center gap-3 border-b border-line px-3 py-1.5">
        <p className="min-w-0 truncate">
          <span className="font-medium text-ink">Fix</span>
          {SEP}
          {run.commit_sha ? (
            <span title={run.commit_sha} className="font-medium text-ink normal-case">
              {shortSha(run.commit_sha)}
            </span>
          ) : (
            <span>{running ? 'No commit yet' : 'No commit'}</span>
          )}
          {run.branch && (
            <>
              {SEP}
              <span title={run.branch} className="normal-case">
                {run.branch}
              </span>
            </>
          )}
        </p>
        <p
          aria-live="polite"
          className={cn('ml-auto flex shrink-0 items-center gap-1.5', status.tone)}
        >
          <RunGlyph status={run.status} />
          {status.label}
        </p>
        {running && (
          // Indeterminate hairline under the top line; a static tint under reduced motion.
          <span aria-hidden="true" className="absolute inset-x-0 -bottom-px h-px overflow-hidden">
            <span className="block h-full w-1/3 animate-indeterminate bg-status-progress motion-reduce:w-full motion-reduce:animate-none motion-reduce:opacity-40" />
          </span>
        )}
      </div>
      <p className="px-3 py-2 [overflow-wrap:anywhere]">
        <DiffStat run={run} />
        {run.pr_url && (
          <>
            {run.files_changed !== null && SEP}
            <a
              href={run.pr_url}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`${prLabel(run.pr_url)} (opens in a new tab)`}
              className="focus-ring inline-flex items-center gap-0.5 rounded-xs whitespace-nowrap text-ink underline decoration-line-input underline-offset-2 hover:decoration-ink"
            >
              {prLabel(run.pr_url)}
              <ArrowUpRight size={12} strokeWidth={1.5} absoluteStrokeWidth aria-hidden="true" />
            </a>
          </>
        )}
        {(run.files_changed !== null || run.pr_url) && SEP}
        {/* Each field wraps as a whole, never mid-phrase. */}
        <span className="whitespace-nowrap">
          {running ? 'Started' : 'Finished'}{' '}
          <time dateTime={when} title={new Date(when).toLocaleString()}>
            {ago(when, now)}
          </time>
        </span>
      </p>
    </div>
  )
}

/** "3m ago", or "just now". */
function ago(iso: string, now: Date): string {
  const rel = relativeTime(iso, now)
  return rel === 'just now' ? rel : /^\d+[mhd]$/.test(rel) ? `${rel} ago` : rel
}

/** `+12 −3 ▮▮▮▮▯ 2 files`, or nothing when the helper reported no diff. */
function DiffStat({ run }: { run: FixRun }) {
  if (run.files_changed === null) return null
  const add = run.additions ?? 0
  const del = run.deletions ?? 0
  const files = `${run.files_changed} ${run.files_changed === 1 ? 'file' : 'files'}`
  return (
    <span className="inline-flex items-center gap-2 align-bottom">
      <span className="sr-only">{`${files}, ${add} additions, ${del} deletions`}</span>
      <span aria-hidden="true" className="inline-flex items-center gap-2">
        <span>
          <span className="text-success">+{add}</span> <span className="text-danger">−{del}</span>
        </span>
        <DiffBar additions={add} deletions={del} />
        <span>{files}</span>
      </span>
    </span>
  )
}

function DiffBar({ additions, deletions }: { additions: number; deletions: number }) {
  return (
    <span className="inline-flex gap-px">
      {diffCells(additions, deletions).map((cell, i) => (
        <span
          key={i}
          className={cn(
            'h-2 w-2 rounded-[1px]',
            cell === 'add' ? 'bg-success' : cell === 'del' ? 'bg-danger' : 'bg-line-2',
          )}
        />
      ))}
    </span>
  )
}

/** Status glyphs on the Specimen 16px grid: half ring (running), check, cross, slash. */
function RunGlyph({ status, className }: { status: FixRunStatus; className?: string }) {
  if (status === 'running') return <StatusGlyph kind="progress" className={className} />
  if (status === 'succeeded') return <StatusGlyph kind="done" className={className} />
  return (
    <svg
      viewBox="0 0 16 16"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      className={cn('h-4 w-4 shrink-0', className)}
    >
      <circle cx="8" cy="8" r="5.25" />
      {status === 'failed' ? <path d="m6 6 4 4m0-4-4 4" /> : <path d="m5 11 6-6" />}
    </svg>
  )
}

/** Earlier runs, collapsed: one hairline-ruled line each. */
function EarlierRuns({ runs, now }: { runs: FixRun[]; now: Date }) {
  const count = `${runs.length} earlier ${runs.length === 1 ? 'run' : 'runs'}`
  return (
    <details className="group mt-6">
      <summary className="t focus-ring flex w-fit cursor-pointer list-none items-center gap-1 rounded-sm text-sm text-ink-2 select-none hover:text-ink pointer-coarse:min-h-11 [&::-webkit-details-marker]:hidden">
        <ChevronRight
          size={14}
          strokeWidth={1.5}
          absoluteStrokeWidth
          aria-hidden="true"
          className="t group-open:rotate-90"
        />
        {count}
      </summary>
      <ol aria-label="Earlier fix runs" className="mt-2 border-t border-line">
        {runs.map((run) => {
          const status = STATUS[run.status]
          const when =
            run.status === 'running' ? run.started_at : (run.finished_at ?? run.started_at)
          return (
            <li
              key={run.id}
              className="flex min-w-0 items-center gap-3 border-b border-line py-2 text-xs"
            >
              <span className={cn('flex w-24 shrink-0 items-center gap-1.5', status.tone)}>
                <RunGlyph status={run.status} />
                {status.label}
              </span>
              <span className="min-w-0 flex-1 truncate">
                {run.commit_sha ? (
                  <span title={run.commit_sha} className="font-mono font-medium text-ink">
                    {shortSha(run.commit_sha)}
                  </span>
                ) : (
                  <span className="text-ink-2">
                    {noCommit(run) ? 'No commit' : 'No commit yet'}
                  </span>
                )}
                {run.branch && (
                  <span title={run.branch} className="font-mono text-ink-3">
                    {' '}
                    {run.branch}
                  </span>
                )}
              </span>
              {run.files_changed !== null && (
                <span className="hidden shrink-0 font-mono text-ink-3 sm:inline">
                  <span className="text-success">+{run.additions ?? 0}</span>{' '}
                  <span className="text-danger">−{run.deletions ?? 0}</span>
                </span>
              )}
              {run.pr_url && (
                <a
                  href={run.pr_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`${prLabel(run.pr_url)} (opens in a new tab)`}
                  className="focus-ring shrink-0 rounded-xs font-mono text-ink underline decoration-line-input underline-offset-2 hover:decoration-ink"
                >
                  {prLabel(run.pr_url)}
                </a>
              )}
              <time
                dateTime={when}
                title={new Date(when).toLocaleString()}
                className="shrink-0 font-mono text-ink-3 nums"
              >
                {ago(when, now)}
              </time>
            </li>
          )
        })}
      </ol>
    </details>
  )
}
