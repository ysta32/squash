import type { BugWithMeta } from './types'

/**
 * The Updates tab: everything resolved lately (by Claude Code, a teammate or you), newest first,
 * with what happened as its resolution note. Each person reviews them on their own: "Looks good"
 * marks one as reviewed, and the tab counts the ones still waiting. Review state lives in this
 * browser (localStorage), per person and workspace.
 */

/** How far back the tab looks, and how many items it lists at most. */
export const UPDATES_WINDOW_DAYS = 30
export const UPDATES_MAX = 50
/** Reviewed entries kept per workspace; older ones fall out of the window anyway. */
const SEEN_MAX = 500
const PREFIX = 'squash:updates:'
/**
 * Slack between this browser's clock and the server's: an item you resolve here is marked reviewed
 * with the local time, a moment before the server stamps its resolved_at.
 */
const CLOCK_SLACK_MS = 2 * 60_000

export interface UpdatesReview {
  /**
   * When this person first opened the workspace with Updates: items resolved before then are
   * never counted as new, so the tab does not open on a backlog of old resolutions.
   */
  since: string
  /**
   * Bug id → when its resolution was reviewed (its resolved_at, or the time you resolved it here).
   * Resolving it again later (after a reopen) shows it anew.
   */
  seen: Record<string, string>
}

export interface UpdateItem {
  bug: BugWithMeta
  /** Resolved since `since` and not reviewed yet. */
  isNew: boolean
}

function key(workspaceId: string, userId: string): string {
  return `${PREFIX}${userId}:${workspaceId}`
}

function isReview(value: unknown): value is UpdatesReview {
  if (typeof value !== 'object' || value === null) return false
  const { since, seen } = value as Partial<UpdatesReview>
  return (
    typeof since === 'string' &&
    !Number.isNaN(Date.parse(since)) &&
    typeof seen === 'object' &&
    seen !== null &&
    Object.values(seen).every((v) => typeof v === 'string')
  )
}

/** The stored review state, or a fresh one starting `now` (stored right away). */
export function loadReview(
  workspaceId: string,
  userId: string,
  now: Date = new Date(),
): UpdatesReview {
  try {
    const raw = localStorage.getItem(key(workspaceId, userId))
    const parsed: unknown = raw === null ? null : JSON.parse(raw)
    if (isReview(parsed)) return parsed
  } catch {
    // Unreadable or blocked storage: start fresh.
  }
  const fresh: UpdatesReview = { since: now.toISOString(), seen: {} }
  saveReview(workspaceId, userId, fresh)
  return fresh
}

export function saveReview(workspaceId: string, userId: string, review: UpdatesReview): void {
  try {
    const entries = Object.entries(review.seen)
    const seen =
      entries.length > SEEN_MAX
        ? Object.fromEntries(
            entries.sort((a, b) => Date.parse(b[1]) - Date.parse(a[1])).slice(0, SEEN_MAX),
          )
        : review.seen
    localStorage.setItem(key(workspaceId, userId), JSON.stringify({ ...review, seen }))
  } catch {
    // Not remembered this time; the review still applies for this session.
  }
}

/**
 * Marks these items reviewed at their current resolution, or, for items you are resolving
 * yourself (`at`), at that moment.
 */
export function markSeen(
  review: UpdatesReview,
  bugs: Pick<BugWithMeta, 'id' | 'resolved_at'>[],
  at?: Date,
): UpdatesReview {
  const seen = { ...review.seen }
  let changed = false
  for (const bug of bugs) {
    const value = at ? at.toISOString() : bug.resolved_at
    if (!value || seen[bug.id] === value) continue
    seen[bug.id] = value
    changed = true
  }
  return changed ? { ...review, seen } : review
}

export function isNewUpdate(bug: BugWithMeta, review: UpdatesReview): boolean {
  return (
    bug.status === 'resolved' &&
    bug.resolved_at !== null &&
    Date.parse(bug.resolved_at) >= Date.parse(review.since) &&
    !(Date.parse(review.seen[bug.id] ?? '') >= Date.parse(bug.resolved_at) - CLOCK_SLACK_MS)
  )
}

/** Items resolved in the last UPDATES_WINDOW_DAYS, newest resolution first. */
export function updateItems(
  bugs: BugWithMeta[],
  review: UpdatesReview,
  now: Date = new Date(),
): UpdateItem[] {
  const from = now.getTime() - UPDATES_WINDOW_DAYS * 86_400_000
  return bugs
    .filter(
      (b): b is BugWithMeta & { resolved_at: string } =>
        !b.optimistic &&
        b.status === 'resolved' &&
        b.resolved_at !== null &&
        Date.parse(b.resolved_at) >= from,
    )
    .sort((a, b) => Date.parse(b.resolved_at) - Date.parse(a.resolved_at))
    .slice(0, UPDATES_MAX)
    .map((bug) => ({ bug, isNew: isNewUpdate(bug, review) }))
}
