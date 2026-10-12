import { useCallback, useMemo, useState } from 'react'
import {
  loadReview,
  markSeen,
  saveReview,
  updateItems,
  type UpdateItem,
  type UpdatesReview,
} from '../lib/updates'
import type { BugWithMeta } from '../lib/types'

export interface UseUpdatesResult {
  /** Recently resolved items, newest first (see lib/updates). */
  items: UpdateItem[]
  /** Items still waiting for a review. */
  newCount: number
  /** "Looks good": marks these items reviewed. */
  markReviewed: (bugs: BugWithMeta[]) => void
  /** Items you are resolving yourself: nothing to review, so they never count as new. */
  markResolvedHere: (ids: string[]) => void
}

/** The Updates tab's items and this person's review of them, remembered in this browser. */
export function useUpdates(
  workspaceId: string,
  userId: string,
  bugs: BugWithMeta[],
): UseUpdatesResult {
  const scope = `${userId}:${workspaceId}`
  const [state, setState] = useState<{ scope: string; review: UpdatesReview } | null>(null)
  let review = state?.review
  if (state?.scope !== scope) {
    review = userId && workspaceId ? loadReview(workspaceId, userId) : undefined
    setState(review ? { scope, review } : null)
  }

  const update = useCallback(
    (fn: (r: UpdatesReview) => UpdatesReview) => {
      setState((s) => {
        if (!s || s.scope !== scope) return s
        const next = fn(s.review)
        if (next === s.review) return s
        saveReview(workspaceId, userId, next)
        return { scope, review: next }
      })
    },
    [scope, workspaceId, userId],
  )

  const markReviewed = useCallback(
    (items: BugWithMeta[]) => update((r) => markSeen(r, items)),
    [update],
  )
  const markResolvedHere = useCallback(
    (ids: string[]) =>
      update((r) =>
        markSeen(
          r,
          ids.map((id) => ({ id, resolved_at: null })),
          new Date(),
        ),
      ),
    [update],
  )

  const items = useMemo(() => (review ? updateItems(bugs, review) : []), [bugs, review])
  const newCount = items.filter((item) => item.isNew).length
  return { items, newCount, markReviewed, markResolvedHere }
}
