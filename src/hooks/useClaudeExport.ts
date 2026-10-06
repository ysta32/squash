import { useCallback, useEffect, useState } from 'react'
import { buildClaudeExport, copyPending, pingBridge, sendToBridge } from '../lib/claudeExport'
import type { BugWithMeta, WorkspaceMember } from '../lib/types'

export interface UseClaudeExportResult {
  /** True when the local bridge is running, so bugs go straight to Claude Code. */
  bridge: boolean
  /** Sends the bugs to Claude Code via the bridge, or copies the prompt when it is not running. */
  exportBugs(bugs: BugWithMeta[]): void
}

export function useClaudeExport(
  workspaceName: string,
  members: WorkspaceMember[],
  onToast: (msg: string) => void,
): UseClaudeExportResult {
  const [bridge, setBridge] = useState(false)

  // Re-check when the tab regains focus, so starting the bridge needs no reload.
  useEffect(() => {
    let active = true
    const check = () => void pingBridge().then((up) => active && setBridge(up))
    check()
    window.addEventListener('focus', check)
    return () => {
      active = false
      window.removeEventListener('focus', check)
    }
  }, [])

  const exportBugs = useCallback(
    (all: BugWithMeta[]) => {
      const bugs = all.filter((b) => !b.optimistic)
      if (bugs.length === 0) return
      const label = bugs.length === 1 ? `#${bugs[0].number}` : `${bugs.length} bugs`
      const input = { bugs, members, workspaceName, origin: window.location.origin }
      const fail = (err: unknown) =>
        onToast(err instanceof Error ? err.message : 'Could not export to Claude.')

      if (bridge) {
        onToast(`Sending ${label} to Claude Code…`)
        sendToBridge(input).then(
          () => onToast(`Claude Code is fixing ${label}`),
          (err: unknown) => {
            setBridge(false)
            fail(err)
          },
        )
        return
      }
      copyPending(buildClaudeExport(input).then((e) => e.prompt)).then(
        () => onToast(`Copied ${label}. Paste into Claude Code.`),
        fail,
      )
    },
    [bridge, members, workspaceName, onToast],
  )

  return { bridge, exportBugs }
}
