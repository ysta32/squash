import { describe, expect, it, vi } from 'vitest'
import type { BugWithMeta } from '../lib/types'
import { applyClaudeRun, retitlePatch } from './useClaudeResults'

vi.mock('../lib/supabase', () => ({ supabase: {} }))

const bug = (number: number, status: 'open' | 'resolved' = 'open') =>
  ({ id: `b${number}`, number, status }) as BugWithMeta

function actions(bugs: BugWithMeta[]) {
  return {
    getBugByNumber: vi.fn(async (n: number) => bugs.find((b) => b.number === n) ?? null),
    resolveBug: vi.fn(async () => {}),
    addComment: vi.fn<(bugId: string, body: string) => Promise<void>>(async () => {}),
  }
}

describe('applyClaudeRun', () => {
  it('resolves finished bugs with the summary and comments on the rest', async () => {
    const a = actions([bug(4), bug(5)])
    const msg = await applyClaudeRun(
      {
        batch: 'x',
        exitCode: 0,
        result: {
          bugs: [
            { number: 4, resolved: true, summary: 'Claude now resolves bugs itself.' },
            { number: 5, resolved: false, summary: 'Needs a design decision.' },
            { number: 99, resolved: true, summary: 'Unknown bug' },
          ],
        },
      },
      a,
    )
    expect(a.resolveBug).toHaveBeenCalledWith('b4', 'Claude now resolves bugs itself.')
    expect(a.addComment).toHaveBeenCalledWith('b5', 'Claude Code: Needs a design decision.')
    expect(a.resolveBug).toHaveBeenCalledTimes(1)
    expect(msg).toBe('Claude Code resolved #4 and left #5 open with a comment.')
  })

  it('does not overwrite a bug someone already resolved', async () => {
    const a = actions([bug(4, 'resolved')])
    await applyClaudeRun(
      {
        batch: 'x',
        exitCode: 0,
        result: { bugs: [{ number: 4, resolved: true, summary: 'Done' }] },
      },
      a,
    )
    expect(a.resolveBug).not.toHaveBeenCalled()
    expect(a.addComment).toHaveBeenCalledWith('b4', 'Claude Code: Done')
  })

  it('changes nothing when Claude did not report back', async () => {
    const a = actions([bug(4)])
    const msg = await applyClaudeRun({ batch: 'x', exitCode: 1, result: null }, a)
    expect(a.resolveBug).not.toHaveBeenCalled()
    expect(msg).toContain('without reporting back (exit 1)')
  })

  it('waits and retries a rate-limited comment instead of dropping the rest of the batch', async () => {
    const a = actions([bug(4), bug(5)])
    a.addComment
      .mockRejectedValueOnce(new Error('rate_limited'))
      .mockRejectedValueOnce(new Error('rate_limited'))
    const sleep = vi.fn(async () => {})
    const msg = await applyClaudeRun(
      {
        batch: 'x',
        exitCode: 0,
        result: {
          bugs: [
            { number: 4, resolved: false, summary: 'First' },
            { number: 5, resolved: false, summary: 'Second' },
          ],
        },
      },
      a,
      { sleep, retryDelaysMs: [10, 20, 30] },
    )
    expect(sleep.mock.calls).toEqual([[10], [20]])
    expect(a.addComment).toHaveBeenCalledTimes(4)
    expect(a.addComment).toHaveBeenLastCalledWith('b5', 'Claude Code: Second')
    expect(msg).toBe('Claude Code left #4, #5 open with a comment.')
  })

  it('names every bug left unapplied when the rate limit outlasts the retries', async () => {
    const a = actions([bug(4), bug(5), bug(6)])
    a.addComment.mockImplementation(async (id: string) => {
      if (id !== 'b4') throw new Error('rate_limited')
    })
    const sleep = vi.fn(async () => {})
    await expect(
      applyClaudeRun(
        {
          batch: 'x',
          exitCode: 0,
          result: {
            bugs: [
              { number: 4, resolved: false, summary: 'ok' },
              { number: 5, resolved: false, summary: 'busy' },
              { number: 6, resolved: true, summary: 'never reached' },
            ],
          },
        },
        a,
        { sleep, retryDelaysMs: [10, 20] },
      ),
    ).rejects.toThrow('Not updated: #5, #6.')
    expect(sleep).toHaveBeenCalledTimes(2)
    expect(a.resolveBug).not.toHaveBeenCalled()
  })

  it('does not retry errors other than the rate limit', async () => {
    const a = actions([bug(4)])
    a.addComment.mockRejectedValue(new Error('permission denied'))
    const sleep = vi.fn(async () => {})
    await expect(
      applyClaudeRun(
        {
          batch: 'x',
          exitCode: 0,
          result: { bugs: [{ number: 4, resolved: false, summary: 's' }] },
        },
        a,
        { sleep },
      ),
    ).rejects.toThrow('permission denied')
    expect(sleep).not.toHaveBeenCalled()
  })

  it('records the run’s git evidence for each bug it resolved, and only those', async () => {
    const a = actions([bug(4), bug(5), bug(6, 'resolved')])
    const recordFixRun = vi.fn(async () => null)
    const sha = 'c'.repeat(40)
    const msg = await applyClaudeRun(
      {
        batch: '20261007-120000-4-5',
        exitCode: 0,
        result: {
          bugs: [
            { number: 4, resolved: true, summary: 'Fixed the crash.' },
            { number: 5, resolved: false, summary: 'Needs a decision.' },
            { number: 6, resolved: true, summary: 'Already done.' },
          ],
        },
        git: {
          startSha: 'd'.repeat(40),
          commitSha: sha,
          branch: 'fix/bug-4',
          prUrl: 'https://github.com/o/r/pull/3',
          filesChanged: 2,
          additions: 5,
          deletions: 1,
          startedAt: '2026-10-07T12:00:00.000Z',
        },
      },
      { ...a, recordFixRun },
    )
    expect(recordFixRun).toHaveBeenCalledTimes(1)
    expect(recordFixRun).toHaveBeenCalledWith({
      bugId: 'b4',
      runId: '20261007-120000-4-5',
      status: 'succeeded',
      summary: 'Fixed the crash.',
      report: expect.objectContaining({ commitSha: sha, branch: 'fix/bug-4', filesChanged: 2 }),
    })
    expect(msg).toBe('Claude Code resolved #4 and left #5 open with a comment.')
  })

  it('records a run from an older helper without evidence', async () => {
    const a = actions([bug(4)])
    const recordFixRun = vi.fn(async () => null)
    await applyClaudeRun(
      { batch: 'x', exitCode: 0, result: { bugs: [{ number: 4, resolved: true, summary: 'ok' }] } },
      { ...a, recordFixRun },
    )
    expect(recordFixRun).toHaveBeenCalledWith(
      expect.objectContaining({ bugId: 'b4', report: null }),
    )
  })

  it('still resolves every bug when recording the proof fails, and says so', async () => {
    const a = actions([bug(4), bug(5)])
    const recordFixRun = vi.fn(async () => {
      throw new Error('fix_run_limit')
    })
    const msg = await applyClaudeRun(
      {
        batch: 'x',
        exitCode: 0,
        result: {
          bugs: [
            { number: 4, resolved: true, summary: 'a' },
            { number: 5, resolved: true, summary: 'b' },
          ],
        },
      },
      { ...a, recordFixRun },
    )
    expect(a.resolveBug).toHaveBeenCalledTimes(2)
    expect(msg).toBe(
      'Claude Code resolved #4, #5. Could not save the proof of fix for #4, #5 (fix_run_limit).',
    )
  })
})

describe('applyClaudeRun with an after screenshot', () => {
  it('attaches the screenshot and records it as the run’s after shot', async () => {
    const a = actions([bug(4)])
    const recordFixRun = vi.fn(async () => null)
    const attachScreenshot = vi.fn(async () => 'att-1')
    await applyClaudeRun(
      {
        batch: 'run',
        exitCode: 0,
        result: {
          bugs: [{ number: 4, resolved: true, summary: 'Done', screenshot: 'after-4.png' }],
        },
      },
      { ...a, recordFixRun, attachScreenshot },
    )
    expect(attachScreenshot).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'b4' }),
      'run',
      'after-4.png',
    )
    expect(recordFixRun).toHaveBeenCalledWith(
      expect.objectContaining({ afterAttachmentId: 'att-1' }),
    )
    expect(a.resolveBug).toHaveBeenCalledWith('b4', 'Done')
  })

  it('still resolves the bug when the screenshot cannot be attached', async () => {
    const a = actions([bug(4)])
    const recordFixRun = vi.fn(async () => null)
    const attachScreenshot = vi.fn(async () => {
      throw new Error('gone')
    })
    const msg = await applyClaudeRun(
      {
        batch: 'run',
        exitCode: 0,
        result: {
          bugs: [{ number: 4, resolved: true, summary: 'Done', screenshot: 'after-4.png' }],
        },
      },
      { ...a, recordFixRun, attachScreenshot },
    )
    expect(a.resolveBug).toHaveBeenCalledWith('b4', 'Done')
    expect(recordFixRun).toHaveBeenCalledWith(
      expect.not.objectContaining({ afterAttachmentId: expect.anything() }),
    )
    expect(msg).toBe('Claude Code resolved #4. Could not attach Claude’s screenshot for #4.')
  })

  it('renames a bug to Claude’s clean title, whether or not it was resolved', async () => {
    const a = {
      ...actions(
        [bug(4), bug(5)].map((b) => ({
          ...b,
          title: 'so um the button…',
          description: 'so um the button does nothing',
          transcript: null,
        })),
      ),
      updateBug: vi.fn(async () => {}),
    }
    await applyClaudeRun(
      {
        batch: 'x',
        exitCode: 0,
        result: {
          bugs: [
            { number: 4, resolved: true, summary: 'Fixed', title: 'Button does nothing' },
            { number: 5, resolved: false, summary: 'Blocked', title: 'Save button broken' },
          ],
        },
      },
      a,
    )
    expect(a.updateBug).toHaveBeenCalledWith('b4', { title: 'Button does nothing' })
    expect(a.updateBug).toHaveBeenCalledWith('b5', { title: 'Save button broken' })
  })

  it('still resolves a bug when the rename fails', async () => {
    const a = {
      ...actions([{ ...bug(4), title: 'old', description: 'old', transcript: null }]),
      updateBug: vi.fn(async () => {
        throw new Error('nope')
      }),
    }
    const msg = await applyClaudeRun(
      {
        batch: 'x',
        exitCode: 0,
        result: { bugs: [{ number: 4, resolved: true, summary: 'Done', title: 'New' }] },
      },
      a,
    )
    expect(a.resolveBug).toHaveBeenCalledWith('b4', 'Done')
    expect(msg).toBe('Claude Code resolved #4. Could not rename #4 to Claude’s title.')
  })
})

describe('retitlePatch', () => {
  const filed = {
    title: 'Also, when it gets sent to Claude, make it rename the issue…',
    description:
      'Also, when it gets sent to Claude, make it rename the issue. The original should stay.',
    transcript: null,
  }

  it('keeps a title cut from the description or transcript where it already is', () => {
    expect(retitlePatch(filed, 'Rename items sent to Claude')).toEqual({
      title: 'Rename items sent to Claude',
    })
    expect(
      retitlePatch(
        { title: 'so the  list…', description: '', transcript: 'So the list is slow' },
        'Slow list',
      ),
    ).toEqual({ title: 'Slow list' })
  })

  it('moves a title found nowhere else into the description', () => {
    expect(
      retitlePatch({ title: 'pls fix', description: 'Steps here', transcript: null }, 'Fix'),
    ).toEqual({
      title: 'Fix',
      description: 'pls fix\n\nSteps here',
    })
    expect(retitlePatch({ title: 'pls fix', description: '', transcript: null }, 'Fix')).toEqual({
      title: 'Fix',
      description: 'pls fix',
    })
  })

  it('changes nothing when the title is already Claude’s', () => {
    expect(retitlePatch(filed, filed.title)).toBeNull()
    expect(retitlePatch(filed, '')).toBeNull()
  })
})
