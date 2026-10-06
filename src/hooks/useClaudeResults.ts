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
 * Applies one finished run: resolves each bug Claude finished with its summary as the note, and
 * comments on the rest. Returns a toast message.
 */
export async function applyClaudeRun(
  run: FinishedRun,
  actions: ClaudeResultActions,
): Promise<string> {
  const items = parseClaudeResult(run.result)
  if (items.length === 0) {
    return `Claude Code finished without reporting back${run.exitCode ? ` (exit ${run.exitCode})` : ''}. Nothing was resolved.`
  }
  const resolved: number[] = []
  const open: number[] = []
  for (const item of items) {
    const bug = await actions.getBugByNumber(item.number)
    if (!bug) continue
    if (item.resolved && bug.status === 'open') {
      await actions.resolveBug(bug.id, item.summary)
      resolved.push(item.number)
    } else {
      await actions.addComment(bug.id, `Claude Code: ${item.summary}`)
      if (!item.resolved) open.push(item.number)
    }
  }
  const list = (ns: number[]) => ns.map((n) => `#${n}`).join(', ')
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
