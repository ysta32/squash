import { useEffect, useRef, useState } from 'react'
import { useFocusTrap } from '../hooks/useFocusTrap'
import { supabase } from '../lib/supabase'
import type { WorkspaceMember } from '../lib/types'
import { cn } from '../lib/utils'
import { Avatar } from './Avatar'
import { popoverClass } from './dialogStyles'

const GRID = 'grid grid-cols-[minmax(0,1fr)_6rem_6rem] items-center gap-3 px-3'

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

  const sum = (key: keyof Omit<StatRow, 'user_id'>) =>
    (rows ?? []).reduce((total, r) => total + r[key], 0)

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-label="Team stats"
      className={cn(
        popoverClass,
        'absolute top-full right-0 z-30 mt-1.5 w-108 py-2 outline-none max-sm:fixed max-sm:inset-x-3 max-sm:top-13 max-sm:w-auto',
      )}
    >
      <div className="flex items-baseline justify-between gap-4 px-3 pt-1 pb-3">
        <h2 className="text-sm font-semibold text-ink">Team stats</h2>
        <span className="font-mono text-xs text-ink-3">7 days / all time</span>
      </div>
      <div role="table" aria-label="Activity by member">
        <div role="row" className={cn(GRID, 'h-7 border-y border-line')}>
          <span role="columnheader" className="specimen-label">
            Member
          </span>
          <span role="columnheader" className="specimen-label text-right">
            Filed
          </span>
          <span role="columnheader" className="specimen-label text-right">
            Resolved
          </span>
        </div>
        {error && (
          <p role="alert" className="px-3 py-3 text-sm text-danger">
            Couldn’t load stats: {error}
          </p>
        )}
        {!error && rows === null && (
          <div className="py-1" aria-busy="true">
            {[0, 1, 2].map((i) => (
              <div key={i} className={cn(GRID, 'h-9')}>
                <span className="flex items-center gap-2">
                  <span className="size-5 rounded-full bg-surface-3 motion-safe:animate-[skeleton-pulse_1.6s_ease-in-out_infinite]" />
                  <span
                    className="h-3 rounded-xs bg-surface-3 motion-safe:animate-[skeleton-pulse_1.6s_ease-in-out_infinite]"
                    style={{ width: `${[55, 40, 48][i]}%` }}
                  />
                </span>
                <span className="ml-auto h-3 w-12 rounded-xs bg-surface-3" />
                <span className="ml-auto h-3 w-12 rounded-xs bg-surface-3" />
              </div>
            ))}
          </div>
        )}
        {rows && rows.length > 0 && (
          <div className="max-h-80 overflow-y-auto">
            {rows.map((r) => {
              const profile = byId.get(r.user_id) ?? null
              return (
                <div
                  key={r.user_id}
                  role="row"
                  className={cn(GRID, 'h-9 border-b border-line text-sm last:border-b-0')}
                >
                  <span role="cell" className="flex min-w-0 items-center gap-2">
                    <Avatar profile={profile} size="xs" />
                    <span className={cn('truncate', profile ? 'text-ink' : 'text-ink-3')}>
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
        {rows && rows.length > 1 && (
          <div role="row" className={cn(GRID, 'h-9 border-t border-line-2 text-sm')}>
            <span role="rowheader" className="specimen-label">
              Team
            </span>
            <Count recent={sum('filed_7d')} total={sum('filed_total')} strong />
            <Count recent={sum('resolved_7d')} total={sum('resolved_total')} strong />
          </div>
        )}
        {rows?.length === 0 && (
          <div className="px-3 py-4">
            <p className="text-sm font-medium text-ink">No activity yet.</p>
            <p className="mt-1 text-sm text-ink-2">Counts appear once someone files a bug.</p>
          </div>
        )}
      </div>
    </div>
  )
}

function Count({ recent, total, strong }: { recent: number; total: number; strong?: boolean }) {
  return (
    <span role="cell" className="text-right font-mono text-xs nums">
      <span className={cn(recent > 0 ? 'text-ink' : 'text-ink-3', strong && 'font-medium')}>
        {recent}
      </span>
      <span className="text-ink-3"> / {total}</span>
    </span>
  )
}
