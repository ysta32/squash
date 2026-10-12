// Type-only: claudeExport loads the Supabase client, which components showing a run never need.
import type { ClaudeRun, ClaudeRunState } from './claudeExport'

export type StatusGlyphKind = 'open' | 'progress' | 'done' | 'working' | 'attention'

export const STATE_LABEL: Record<ClaudeRunState, string> = {
  queued: 'Queued: starts when a Claude run finishes',
  starting: 'Starting Claude Code…',
  working: 'Claude is working',
  waiting: 'Claude needs you in Terminal',
  done: 'Claude finished',
  ended: 'Claude session closed',
}

export const STATE_GLYPH: Record<ClaudeRunState, { kind: StatusGlyphKind; tone: string }> = {
  queued: { kind: 'open', tone: 'text-ink-3' },
  starting: { kind: 'working', tone: 'text-ink-3' },
  working: { kind: 'working', tone: 'text-status-progress' },
  waiting: { kind: 'attention', tone: 'text-warning' },
  done: { kind: 'done', tone: 'text-status-resolved' },
  ended: { kind: 'open', tone: 'text-ink-3' },
}

/** "45s", "3m 12s", "1h 4m" between an ISO time and `to`. */
export function elapsed(fromIso: string, to: Date): string {
  const s = Math.max(0, Math.round((to.getTime() - new Date(fromIso).getTime()) / 1000))
  if (s < 60) return `${s}s`
  if (s < 3600) return `${Math.floor(s / 60)}m ${s % 60}s`
  return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`
}

/**
 * Runs for the Running view: those in progress first (the one needing you on top), then finished
 * ones, newest activity first within each group.
 */
export function orderRuns(runs: ClaudeRun[]): ClaudeRun[] {
  const rank = (run: ClaudeRun) =>
    run.state === 'waiting'
      ? 0
      : run.state === 'starting' || run.state === 'working'
        ? 1
        : run.state === 'queued'
          ? 2
          : 3
  return [...runs].sort(
    (a, b) => rank(a) - rank(b) || Date.parse(b.updatedAt) - Date.parse(a.updatedAt),
  )
}
