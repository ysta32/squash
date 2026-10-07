import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Database } from '../lib/database.types'

export type BugDeletion = Database['public']['Tables']['bug_deletions']['Row']

const LIMIT = 50

type Result = { workspaceId: string; deletions: BugDeletion[]; error: string | null }

export function useDeletionLog(workspaceId: string) {
  const [result, setResult] = useState<Result | null>(null)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      let next: Result
      try {
        const { data, error } = await supabase
          .from('bug_deletions')
          .select('*')
          .eq('workspace_id', workspaceId)
          .order('deleted_at', { ascending: false })
          .limit(LIMIT)
        next = error
          ? { workspaceId, deletions: [], error: error.message }
          : { workspaceId, deletions: data ?? [], error: null }
      } catch (cause) {
        next = {
          workspaceId,
          deletions: [],
          error: cause instanceof Error ? cause.message : 'Could not load deleted bugs.',
        }
      }
      if (!cancelled) setResult(next)
    })()
    return () => {
      cancelled = true
    }
  }, [workspaceId])

  const current = result?.workspaceId === workspaceId ? result : null
  return {
    deletions: current?.deletions ?? [],
    loading: current === null,
    error: current?.error ?? null,
  }
}
