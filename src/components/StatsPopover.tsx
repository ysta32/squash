import { useEffect, useRef, useState } from 'react'
import { useFocusTrap } from '../hooks/useFocusTrap'
import { supabase } from '../lib/supabase'
import type { WorkspaceMember } from '../lib/types'
import { cn } from '../lib/utils'
import { Avatar } from './Avatar'

const GRID = 'grid grid-cols-[minmax(0,1fr)_5.5rem_5.5rem] items-center gap-3 px-2'

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
  const dialogRef = useRef<HTMLDivElement>(null)
  useFocusTrap(dialogRef)
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
    <div
      ref={dialogRef}
      role="dialog"
      aria-label="Team stats"
      className="t absolute right-0 top-full z-30 mt-1 w-[26rem] rounded-lg border border-border bg-bg-elevated p-1 shadow-elevated starting:-translate-y-1 starting:opacity-0 max-sm:fixed max-sm:inset-x-3 max-sm:top-13 max-sm:w-auto"
    >
      <div className="flex items-baseline justify-between px-2 pt-2 pb-1.5">
        <h2 className="text-sm font-medium text-fg">Team stats</h2>
        <span className="text-xs text-muted">Last 7 days / all time</span>
      </div>
      <div role="table" aria-label="Activity by member">
        <div
          role="row"
          className={cn(
            GRID,
            'h-7 border-b border-border text-[11px] font-medium tracking-wide text-muted uppercase',
          )}
        >
          <span role="columnheader">Member</span>
          <span role="columnheader" className="text-right">
            Filed
          </span>
          <span role="columnheader" className="text-right">
            Resolved
          </span>
        </div>
        {error && (
          <p role="alert" className="px-2 py-3 text-sm text-danger">
            {error}
          </p>
        )}
        {!error && rows === null && (
          <div className="space-y-1 px-2 py-1.5" aria-busy="true">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-7 animate-pulse rounded-md bg-bg-subtle" />
            ))}
          </div>
        )}
        {rows && rows.length > 0 && (
          <div className="max-h-80 overflow-y-auto py-1">
            {rows.map((r) => {
              const profile = byId.get(r.user_id) ?? null
              return (
                <div
                  key={r.user_id}
                  role="row"
                  className={cn(GRID, 'h-8 rounded-md text-sm hover:bg-bg-subtle')}
                >
                  <span role="cell" className="flex min-w-0 items-center gap-2">
                    <Avatar profile={profile} size="xs" />
                    <span className={cn('truncate', !profile && 'text-muted')}>
                      {profile?.display_name ?? 'Former member'}
                    </span>
                  </span>
                  <Count recent={r.filed_7d} total={r.filed_total} />
                  <Count recent={r.resolved_7d} total={r.resolved_total} />
                </div>
              )
            })}
          </div>
        )}
        {rows?.length === 0 && (
          <p className="px-2 py-6 text-center text-sm text-muted">No activity yet.</p>
        )}
      </div>
    </div>
  )
}

function Count({ recent, total }: { recent: number; total: number }) {
  return (
    <span role="cell" className="text-right tabular-nums">
      <span className={recent > 0 ? 'text-fg' : 'text-muted'}>{recent}</span>
      <span className="text-muted"> / {total}</span>
    </span>
  )
}
