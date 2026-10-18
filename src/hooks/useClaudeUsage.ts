import { useEffect, useState } from 'react'
import { getBridgeUsage, type ClaudeUsage } from '../lib/claudeExport'

/** How often to reload usage: a run that finishes adds to it, and the plan limits move. */
const POLL_MS = 30_000

/**
 * Claude usage for this workspace on this computer, from the Claude Code helper. `enabled` is false
 * while the helper is missing or too old (before v13) to record usage; usage is then null.
 * `refreshKey` reloads it at once when it changes (e.g. when a run finishes).
 */
export function useClaudeUsage(
  workspaceId: string,
  enabled: boolean,
  refreshKey: unknown = null,
): ClaudeUsage | null {
  const [state, setState] = useState<{ workspaceId: string; usage: ClaudeUsage } | null>(null)

  useEffect(() => {
    if (!enabled) return
    let active = true
    const load = () =>
      void getBridgeUsage(workspaceId).then(
        (usage) => active && setState({ workspaceId, usage }),
        () => {},
      )
    load()
    const timer = setInterval(load, POLL_MS)
    window.addEventListener('focus', load)
    return () => {
      active = false
      clearInterval(timer)
      window.removeEventListener('focus', load)
    }
  }, [enabled, workspaceId, refreshKey])

  return enabled && state?.workspaceId === workspaceId ? state.usage : null
}
