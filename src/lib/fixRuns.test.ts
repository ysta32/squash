import { describe, expect, it } from 'vitest'
import {
  FIX_SUMMARY_MAX,
  buildFixRunInsert,
  formatDiffStat,
  isBranchName,
  isCommitSha,
  isMissingRelation,
  isPrUrl,
  parseFixReport,
} from './fixRuns'

const SHA = 'a'.repeat(40)

describe('parseFixReport', () => {
  it('keeps a well-formed report from the helper', () => {
    expect(
      parseFixReport({
        startSha: 'b'.repeat(40),
        commitSha: ` ${SHA.toUpperCase()} `,
        branch: 'fix/bug-12',
        prUrl: 'https://github.com/o/r/pull/12',
        filesChanged: 3,
        additions: 10,
        deletions: 0,
        startedAt: '2026-10-07T12:00:00.000Z',
      }),
    ).toEqual({
      startSha: 'b'.repeat(40),
      commitSha: SHA,
      branch: 'fix/bug-12',
      prUrl: 'https://github.com/o/r/pull/12',
      filesChanged: 3,
      additions: 10,
      deletions: 0,
      startedAt: '2026-10-07T12:00:00.000Z',
    })
  })

  it('drops each malformed field and keeps the rest', () => {
    expect(
      parseFixReport({
        startSha: 'nope',
        commitSha: SHA,
        branch: 'has space',
        prUrl: 'http://github.com/o/r/pull/1',
        filesChanged: -1,
        additions: 1.5,
        deletions: '2',
        startedAt: 'yesterday',
      }),
    ).toEqual({
      startSha: null,
      commitSha: SHA,
      branch: null,
      prUrl: null,
      filesChanged: null,
      additions: null,
      deletions: null,
      startedAt: null,
    })
  })

  it('is null for anything that is not a report or carries no evidence', () => {
    for (const value of [null, undefined, 'x', 42, [], {}, { startedAt: '2026-10-07T12:00:00Z' }]) {
      expect(parseFixReport(value)).toBeNull()
    }
  })
})

describe('validators mirror the table checks', () => {
  it('commit sha: 7 to 40 lower-case hex', () => {
    expect(isCommitSha('abc1234')).toBe(true)
    expect(isCommitSha(SHA)).toBe(true)
    for (const bad of ['abc123', 'ABC1234', 'xyz1234', 'a'.repeat(41), '', null]) {
      expect(isCommitSha(bad)).toBe(false)
    }
  })

  it('PR URL: https, a host, a path, no spaces, at most 500 characters', () => {
    expect(isPrUrl('https://github.com/o/r/pull/1')).toBe(true)
    expect(isPrUrl('https://ghe.example.com:8443/o/r/pull/1')).toBe(true)
    for (const bad of [
      'http://github.com/o/r/pull/1',
      'https://github.com',
      'https://user@github.com/x',
      'https://github.com/a b',
      'javascript:alert(1)',
      `https://github.com/${'a'.repeat(500)}`,
    ]) {
      expect(isPrUrl(bad)).toBe(false)
    }
  })

  it('branch: no whitespace or control characters, not detached HEAD, at most 255', () => {
    expect(isBranchName('feature/ünïcode-1')).toBe(true)
    for (const bad of ['', 'HEAD', 'a b', 'a\tb', 'x'.repeat(256)]) {
      expect(isBranchName(bad)).toBe(false)
    }
  })
})

describe('buildFixRunInsert', () => {
  const report = parseFixReport({
    commitSha: SHA,
    branch: 'main',
    filesChanged: 1,
    additions: 2,
    deletions: 3,
    startedAt: '2026-10-07T12:00:00Z',
  })

  it('maps the report onto the table columns', () => {
    expect(
      buildFixRunInsert({
        bugId: 'b1',
        runId: '20261007-120000-4',
        status: 'succeeded',
        summary: '  Fixed it  ',
        report,
      }),
    ).toEqual({
      bug_id: 'b1',
      run_id: '20261007-120000-4',
      status: 'succeeded',
      summary: 'Fixed it',
      branch: 'main',
      commit_sha: SHA,
      pr_url: null,
      files_changed: 1,
      additions: 2,
      deletions: 3,
      started_at: '2026-10-07T12:00:00.000Z',
    })
  })

  it('records a run without evidence (older helper) and caps the summary', () => {
    const row = buildFixRunInsert({
      bugId: 'b1',
      runId: 'r',
      status: 'succeeded',
      summary: 'x'.repeat(FIX_SUMMARY_MAX + 10),
      report: null,
    })
    expect(row.summary).toHaveLength(FIX_SUMMARY_MAX)
    expect(row.commit_sha).toBeNull()
    expect(row).not.toHaveProperty('started_at')
    expect(
      buildFixRunInsert({ bugId: 'b', runId: 'r', status: 'failed', summary: ' ', report: null })
        .summary,
    ).toBeNull()
  })

  it('refuses run ids and statuses the table would reject', () => {
    const base = { bugId: 'b', summary: null, report: null }
    expect(() => buildFixRunInsert({ ...base, runId: '../x', status: 'succeeded' })).toThrow()
    expect(() => buildFixRunInsert({ ...base, runId: '.x', status: 'succeeded' })).toThrow()
    expect(() =>
      buildFixRunInsert({ ...base, runId: 'r', status: 'done' as unknown as 'succeeded' }),
    ).toThrow()
  })
})

describe('isMissingRelation', () => {
  it('matches Postgres and PostgREST missing-table errors for that table only', () => {
    expect(
      isMissingRelation(
        { code: '42P01', message: 'relation "public.fix_runs" does not exist' },
        'fix_runs',
      ),
    ).toBe(true)
    expect(
      isMissingRelation(
        {
          code: 'PGRST205',
          message: "Could not find the table 'public.fix_runs' in the schema cache",
        },
        'fix_runs',
      ),
    ).toBe(true)
    expect(
      isMissingRelation({ code: '42P01', message: 'relation "bugs" does not exist' }, 'fix_runs'),
    ).toBe(false)
    expect(
      isMissingRelation({ code: '42501', message: 'fix_runs: permission denied' }, 'fix_runs'),
    ).toBe(false)
    expect(isMissingRelation(null, 'fix_runs')).toBe(false)
  })
})

describe('formatDiffStat', () => {
  it('summarizes a diff, or null when none was reported', () => {
    expect(formatDiffStat({ files_changed: 3, additions: 10, deletions: 2 })).toBe(
      '3 files, +10 −2',
    )
    expect(formatDiffStat({ files_changed: 1, additions: null, deletions: null })).toBe(
      '1 file, +0 −0',
    )
    expect(formatDiffStat({ files_changed: null, additions: 1, deletions: 1 })).toBeNull()
  })
})
