import { describe, expect, it, vi } from 'vitest'
import type { BugWithMeta } from '../lib/types'
import { applyClaudeRun } from './useClaudeResults'

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
})
