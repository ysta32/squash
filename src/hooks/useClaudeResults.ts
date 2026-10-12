import { useEffect, useRef } from 'react'
import { requireUserId } from './useBug'
import {
  claimBridgeResult,
  getBridgeResults,
  getBridgeScreenshot,
  parseClaudeResult,
  type FinishedRun,
} from '../lib/claudeExport'
import { parseFixReport, type FixRunInput } from '../lib/fixRuns'
import { supabase } from '../lib/supabase'
import { uploadAttachment } from '../lib/upload'
import { recordFixRun } from './useFixRuns'
import { compressImage } from './useImageCompression'
import type { BugWithMeta } from '../lib/types'

const POLL_MS = 5000

export interface ClaudeResultActions {
  getBugByNumber(number: number): Promise<BugWithMeta | null>
  resolveBug(id: string, note: string | null): Promise<void>
  /** Renames a bug to the clean title Claude wrote, keeping its original wording elsewhere. */
  updateBug?(id: string, patch: { title: string; description?: string }): Promise<void>
  addComment(bugId: string, body: string): Promise<void>
  /** Stores the run's git evidence for a bug it resolved (proof of fix). */
  recordFixRun?(input: FixRunInput): Promise<unknown>
  /**
   * Attaches the after screenshot Claude saved for a bug (`file` in the run's batch folder) and
   * returns the new attachment's id.
   */
  attachScreenshot?(bug: BugWithMeta, batch: string, file: string): Promise<string>
}

/** Fetches an after screenshot from the helper and attaches it to the bug like any screenshot. */
export async function attachRunScreenshot(
  bug: BugWithMeta,
  batch: string,
  file: string,
): Promise<string> {
  const blob = await getBridgeScreenshot(bug.workspace_id, batch, file)
  const image = await compressImage(blob)
  try {
    const attachment = await uploadAttachment({
      workspaceId: bug.workspace_id,
      bugId: bug.id,
      image,
    })
    return attachment.id
  } finally {
    URL.revokeObjectURL(image.previewUrl)
  }
}

/**
 * The edit that gives a bug Claude's clean title, or null when it already has it. A title filed by
 * voice or as a quick note is cut from the description or transcript, so the full wording stays
 * there; a title found in neither moves to the top of the description so it is never lost.
 */
export function retitlePatch(
  bug: Pick<BugWithMeta, 'title' | 'description' | 'transcript'>,
  title: string,
): { title: string; description?: string } | null {
  const old = bug.title.trim()
  if (!title || title === old) return null
  const words = (text: string) => text.replace(/\s+/g, ' ').trim().toLowerCase()
  const kept = words(old.replace(/…$/, ''))
  const description = bug.description.trim()
  if (!kept || [description, bug.transcript ?? ''].some((text) => words(text).includes(kept))) {
    return { title }
  }
  return { title, description: description ? `${old}\n\n${description}` : old }
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
  const unrecorded: number[] = []
  const noScreenshot: number[] = []
  const unrenamed: number[] = []
  let recordError: string | null = null
  const report = parseFixReport(run.git)
  const list = (ns: number[]) => ns.map((n) => `#${n}`).join(', ')
  for (const [i, item] of items.entries()) {
    try {
      const bug = await actions.getBugByNumber(item.number)
      if (!bug) continue
      const retitle = item.title && actions.updateBug ? retitlePatch(bug, item.title) : null
      if (retitle && actions.updateBug) {
        // A clean title is a bonus: the result applies whether or not the rename goes through.
        try {
          await withRetry(() => actions.updateBug!(bug.id, retitle))
        } catch {
          unrenamed.push(item.number)
        }
      }
      if (item.resolved && bug.status === 'open') {
        // The screenshot is a bonus: a bug is resolved whether or not it can be attached.
        let afterAttachmentId: string | null = null
        if (item.screenshot && actions.attachScreenshot) {
          try {
            afterAttachmentId = await actions.attachScreenshot(bug, run.batch, item.screenshot)
          } catch {
            noScreenshot.push(item.number)
          }
        }
        await withRetry(() => actions.resolveBug(bug.id, item.summary))
        resolved.push(item.number)
        if (actions.recordFixRun) {
          // The bug is resolved either way; a failed record is reported, not retried.
          try {
            await actions.recordFixRun({
              bugId: bug.id,
              runId: run.batch,
              status: 'succeeded',
              summary: item.summary,
              report,
              ...(afterAttachmentId ? { afterAttachmentId } : {}),
            })
          } catch (err) {
            unrecorded.push(item.number)
            recordError ??= err instanceof Error ? err.message : String(err)
          }
        }
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
  const message =
    parts.length > 0 ? `Claude Code ${parts.join(' and ')}.` : 'Claude Code reported back.'
  const notes = [message]
  if (unrecorded.length > 0) {
    notes.push(`Could not save the proof of fix for ${list(unrecorded)} (${recordError}).`)
  }
  if (noScreenshot.length > 0) {
    notes.push(`Could not attach Claude’s screenshot for ${list(noScreenshot)}.`)
  }
  if (unrenamed.length > 0) {
    notes.push(`Could not rename ${list(unrenamed)} to Claude’s title.`)
  }
  return notes.join(' ')
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
            toast(
              await applyClaudeRun(run, {
                ...rest,
                addComment: postComment,
                recordFixRun,
                attachScreenshot: attachRunScreenshot,
              }),
            )
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
