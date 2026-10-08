import type { Database } from './database.types'

/**
 * Proof of fix: what the local helper reports about the git state a Claude Code run left behind,
 * and the fix_runs rows it becomes (supabase/migrations/0008_fix_runs.sql). Every check here mirrors
 * a CHECK constraint on the table, so a value that passes is never rejected by the server.
 */

export type FixRun = Database['public']['Tables']['fix_runs']['Row']
export type FixRunInsert = Database['public']['Tables']['fix_runs']['Insert']
export type FixRunStatus = FixRun['status']

export const FIX_RUN_STATUSES: readonly FixRunStatus[] = [
  'running',
  'succeeded',
  'failed',
  'cancelled',
]

/** fix_runs.summary cap (same as RESULT_SUMMARY_MAX in claudeExport). */
export const FIX_SUMMARY_MAX = 4000
export const PR_URL_MAX = 500
export const BRANCH_MAX = 255
const INT_MAX = 2_147_483_647

const SHA = /^[0-9a-f]{7,40}$/
const RUN_ID = /^[A-Za-z0-9_-][A-Za-z0-9_.-]{0,79}$/
const BRANCH = /^[^\s\p{Cc}]+$/u
const PR_URL = /^https:\/\/[A-Za-z0-9.-]+(:[0-9]{1,5})?\/[!-~]*$/

/**
 * Where fix evidence comes from. It is self-reported by the local helper (git and gh on the
 * developer's machine) and not verified against the git host, so the UI must say so.
 */
export const FIX_EVIDENCE_SOURCE = 'helper'
export const FIX_EVIDENCE_LABEL = 'Reported by the Claude Code helper'

/** The git evidence for one run, as reported by the helper (bridge v7+). */
export interface FixReport {
  /** Always 'helper': self-reported, unverified (see FIX_EVIDENCE_LABEL). */
  source: typeof FIX_EVIDENCE_SOURCE
  /** HEAD when the run began, or null outside a git repo / before the first commit. */
  startSha: string | null
  /** HEAD when the run ended; null when the run made no commit (see noCommit). */
  commitSha: string | null
  /** True when HEAD never moved: the run committed nothing. */
  noCommit: boolean
  /** The checked-out branch, or null when detached. */
  branch: string | null
  prUrl: string | null
  filesChanged: number | null
  additions: number | null
  deletions: number | null
  /** When the run began (ISO 8601). */
  startedAt: string | null
}

export function isCommitSha(value: unknown): value is string {
  return typeof value === 'string' && SHA.test(value)
}

export function isRunId(value: unknown): value is string {
  return typeof value === 'string' && RUN_ID.test(value)
}

export function isBranchName(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value !== 'HEAD' &&
    [...value].length <= BRANCH_MAX &&
    BRANCH.test(value)
  )
}

export function isPrUrl(value: unknown): value is string {
  return typeof value === 'string' && value.length <= PR_URL_MAX && PR_URL.test(value)
}

function count(value: unknown): number | null {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= INT_MAX
    ? value
    : null
}

function sha(value: unknown): string | null {
  const v = typeof value === 'string' ? value.trim().toLowerCase() : null
  return isCommitSha(v) ? v : null
}

function timestamp(value: unknown): string | null {
  if (typeof value !== 'string' || value.length > 40) return null
  const t = Date.parse(value)
  return Number.isNaN(t) ? null : new Date(t).toISOString()
}

/**
 * Validates the helper's `git` report. Each field that is missing or malformed becomes null (the
 * rest is kept); anything that is not an object, or carries no evidence at all, is null.
 */
export function parseFixReport(value: unknown): FixReport | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const v = value as Record<string, unknown>
  const startSha = sha(v.startSha)
  const reported = sha(v.commitSha)
  // The start commit is never proof of a fix, whatever the helper claims.
  const noCommit =
    v.noCommit === true || (reported !== null && startSha !== null && startSha.startsWith(reported))
  const report: FixReport = {
    source: FIX_EVIDENCE_SOURCE,
    startSha,
    commitSha: noCommit ? null : reported,
    noCommit,
    branch: isBranchName(v.branch) ? v.branch : null,
    prUrl: !noCommit && isPrUrl(v.prUrl) ? v.prUrl : null,
    filesChanged: count(v.filesChanged),
    additions: count(v.additions),
    deletions: count(v.deletions),
    startedAt: timestamp(v.startedAt),
  }
  const { source: _source, startedAt: _when, noCommit: _none, ...evidence } = report
  void _source
  void _when
  void _none
  return noCommit || Object.values(evidence).some((x) => x !== null) ? report : null
}

export interface FixRunInput {
  bugId: string
  /** The helper's batch name. */
  runId: string
  status: FixRunStatus
  summary: string | null
  report: FixReport | null
}

/** The row to insert for one bug of a run; throws when the run id is not one the table accepts. */
export function buildFixRunInsert({
  bugId,
  runId,
  status,
  summary,
  report,
}: FixRunInput): FixRunInsert {
  if (!isRunId(runId)) throw new Error('Invalid run id.')
  if (!FIX_RUN_STATUSES.includes(status)) throw new Error('Invalid fix run status.')
  const text = summary?.trim() ?? ''
  return {
    bug_id: bugId,
    run_id: runId,
    status,
    summary: text ? text.slice(0, FIX_SUMMARY_MAX) : null,
    branch: report?.branch ?? null,
    commit_sha: report?.commitSha ?? null,
    pr_url: report?.prUrl ?? null,
    files_changed: report?.filesChanged ?? null,
    additions: report?.additions ?? null,
    deletions: report?.deletions ?? null,
    ...(report?.startedAt ? { started_at: report.startedAt } : {}),
  }
}

/**
 * Whether an error says the table does not exist (its migration has not been applied yet):
 * Postgres 42P01, or PostgREST PGRST205 when the table is missing from its schema cache.
 */
export function isMissingRelation(error: unknown, relation: string): boolean {
  if (!error || typeof error !== 'object') return false
  const { code, message } = error as { code?: unknown; message?: unknown }
  const text = typeof message === 'string' ? message : ''
  return (code === '42P01' || code === 'PGRST205') && text.includes(relation)
}

/** "3 files, +10 −2" for a run's diff, or null when the helper did not report one. */
export function formatDiffStat(
  run: Pick<FixRun, 'files_changed' | 'additions' | 'deletions'>,
): string | null {
  if (run.files_changed === null) return null
  const files = `${run.files_changed} file${run.files_changed === 1 ? '' : 's'}`
  return `${files}, +${run.additions ?? 0} −${run.deletions ?? 0}`
}
