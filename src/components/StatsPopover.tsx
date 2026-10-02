import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { WorkspaceMember } from '../lib/types'
import { Avatar } from './Avatar'

interface StatRow {
  user_id: string
  filed_total: number
  resolved_total: number
  filed_7d: number
  resolved_7d: number
}

export interface StatsPopoverProps {
  workspaceId: string
  members: WorkspaceMember[]
}

export function StatsPopover({ workspaceId, members }: StatsPopoverProps) {
  const [result, setResult] = useState<{
    workspaceId: string
    rows: StatRow[] | null
    error: string | null
  } | null>(null)
  const current = result && result.workspaceId === workspaceId ? result : null
  const rows = current?.rows ?? null
  const error = current?.error ?? null

  useEffect(() => {
    let stale = false
    void supabase
      .rpc('workspace_stats', { p_workspace_id: workspaceId })
      .then(({ data, error: err }) => {
        if (stale) return
        if (err) setResult({ workspaceId, rows: null, error: err.message })
        else
          setResult({
            workspaceId,
            rows: [...(data ?? [])].sort((a, b) => b.filed_total - a.filed_total),
            error: null,
          })
      })
    return () => {
      stale = true
    }
  }, [workspaceId])

  const byId = new Map(members.map((m) => [m.user_id, m.profile]))

  return (
    <div className="absolute right-0 top-full z-30 mt-1 w-80 rounded-lg border border-zinc-200 bg-white p-3 shadow-lg dark:border-zinc-800 dark:bg-zinc-900">
      <div className="mb-2 grid grid-cols-[1fr_4.5rem_4.5rem] gap-2 text-xs text-zinc-500">
        <span>Member</span>
        <span className="text-right">Filed 7d / all</span>
        <span className="text-right">Resolved 7d / all</span>
      </div>
      {error && <p className="text-sm text-red-500">{error}</p>}
      {!error && rows === null && (
        <div className="space-y-2" aria-busy="true">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-6 animate-pulse rounded bg-zinc-100 dark:bg-zinc-800" />
          ))}
        </div>
      )}
      {rows?.map((r) => {
        const profile = byId.get(r.user_id) ?? null
        return (
          <div
            key={r.user_id}
            className="grid grid-cols-[1fr_4.5rem_4.5rem] items-center gap-2 py-1 text-sm"
          >
            <span className="flex min-w-0 items-center gap-2">
              <Avatar profile={profile} size="xs" />
              <span className="truncate">{profile?.display_name ?? 'Former member'}</span>
            </span>
            <span className="text-right tabular-nums">
              {r.filed_7d} / {r.filed_total}
            </span>
            <span className="text-right tabular-nums">
              {r.resolved_7d} / {r.resolved_total}
            </span>
          </div>
        )
      })}
      {rows?.length === 0 && <p className="text-sm text-zinc-500">No activity yet.</p>}
    </div>
  )
}
