import { useEffect, useRef } from 'react'
import { requireUserId } from './useBug'
import {
  claimBridgeResult,
  getBridgeResults,
  parseClaudeResult,
  type FinishedRun,
} from '../lib/claudeExport'
import { supabase } from '../lib/supabase'
import type { BugWithMeta } from '../lib/types'

const POLL_MS = 5000

export interface ClaudeResultActions {
  getBugByNumber(number: number): Promise<BugWithMeta | null>
  resolveBug(id: string, note: string | null): Promise<void>
  addComment(bugId: string, body: string): Promise<void>
}

/** Posts a comment on any bug in the workspace as the signed-in user. */
export async function postComment(bugId: string, body: string): Promise<void> {
  const authorId = await requireUserId()
  const { error } = await supabase
    .from('comments')
    .insert({ bug_id: bugId, author_id: authorId, body })
  if (error) throw new Error(error.message)
}

/**
 * Waits before each retry of an item the server rate limited (30 comments per minute). The last
 * wait outlasts the whole 60-second window, so a burst from this tab alone always gets through.
 */
export const RATE_LIMIT_RETRY_MS = [5_000, 15_000, 30_000, 65_000]

export interface ApplyOptions {
  /** Injected in tests; defaults to setTimeout. */
  sleep?: (ms: number) => Promise<void>
  retryDelaysMs?: readonly number[]
}

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

function isRateLimited(err: unknown): boolean {
  return err instanceof Error && /rate_limited|^Slow down/.test(err.message)
}

/**
 * Applies one finished run: resolves each bug Claude finished with its summary as the note, and
 * comments on the rest. Returns a toast message. The batch is already claimed, so it is never
 * offered again: an item the server rate limits is retried after a wait instead of being dropped,
 * and if it still fails the error names every bug that was not updated.
 */
export async function applyClaudeRun(
  run: FinishedRun,
  actions: ClaudeResultActions,
  { sleep = defaultSleep, retryDelaysMs = RATE_LIMIT_RETRY_MS }: ApplyOptions = {},
): Promise<string> {
  const withRetry = async (step: () => Promise<void>) => {
    for (let attempt = 0; ; attempt++) {
      try {
        return await step()
      } catch (err) {
        if (!isRateLimited(err) || attempt >= retryDelaysMs.length) throw err
        await sleep(retryDelaysMs[attempt])
      }
    }
  }
  const items = parseClaudeResult(run.result)
  if (items.length === 0) {
    return `Claude Code finished without reporting back${run.exitCode ? ` (exit ${run.exitCode})` : ''}. Nothing was resolved.`
  }
  const resolved: number[] = []
  const open: number[] = []
  const list = (ns: number[]) => ns.map((n) => `#${n}`).join(', ')
  for (const [i, item] of items.entries()) {
    try {
      const bug = await actions.getBugByNumber(item.number)
      if (!bug) continue
      if (item.resolved && bug.status === 'open') {
        await withRetry(() => actions.resolveBug(bug.id, item.summary))
        resolved.push(item.number)
      } else {
        await withRetry(() => actions.addComment(bug.id, `Claude Code: ${item.summary}`))
        if (!item.resolved) open.push(item.number)
      }
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err)
      const skipped = list(items.slice(i).map((it) => it.number))
      throw new Error(
        `Could not apply all of Claude Code’s result (${reason}). Not updated: ${skipped}.`,
        { cause: err },
      )
    }
  }
  const parts = []
  if (resolved.length > 0) parts.push(`resolved ${list(resolved)}`)
  if (open.length > 0) parts.push(`left ${list(open)} open with a comment`)
  return parts.length > 0 ? `Claude Code ${parts.join(' and ')}.` : 'Claude Code reported back.'
}

/**
 * While the bridge is connected, picks up runs Claude Code has finished and applies them, so a bug
 * sent to Claude is resolved without anyone coming back to it.
 */
export function useClaudeResults(
  workspaceId: string,
  enabled: boolean,
  actions: Omit<ClaudeResultActions, 'addComment'>,
  onToast: (msg: string) => void,
): void {
  const latest = useRef({ ...actions, onToast })
  useEffect(() => {
    latest.current = { ...actions, onToast }
  })

  useEffect(() => {
    if (!enabled) return
    let active = true
    let busy = false
    const check = async () => {
      if (busy) return
      busy = true
      try {
        for (const run of await getBridgeResults(workspaceId)) {
          if (!active) return
          // Claim first so two open tabs never apply the same run twice.
          if (!(await claimBridgeResult(workspaceId, run.batch))) continue
          const { onToast: toast, ...rest } = latest.current
          try {
            toast(await applyClaudeRun(run, { ...rest, addComment: postComment }))
          } catch (err) {
            toast(err instanceof Error ? err.message : 'Could not apply Claude Code’s result.')
          }
        }
      } catch {
        // Bridge unreachable or outdated: try again on the next tick.
      } finally {
        busy = false
      }
    }
    void check()
    const timer = setInterval(() => void check(), POLL_MS)
    return () => {
      active = false
      clearInterval(timer)
    }
  }, [workspaceId, enabled])
}
