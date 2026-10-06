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
    addComment: vi.fn(async () => {}),
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
})
