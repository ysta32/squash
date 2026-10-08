import { parseAnnotations, toClaudeRegions } from './annotations'
import type { BugAttachment } from './types'

/** Clearance between the divider and the marked subject, as a fraction of the frame width. */
const SUBJECT_GAP = 0.04
/** A pin is a point: treat it as a mark this wide either side. */
const PIN_REACH = 0.03
/** The divider never starts closer to an edge than this (percent), so both images show. */
const EDGE_MIN = 15

/**
 * Where the divider starts, in percent. The "before" screenshot's markup is the subject the fix is
 * about; the divider starts just past it (right if there is room, else left) so it frames the
 * subject instead of cutting through it. Without markup it starts in the middle.
 */
export function initialSplit(annotations: BugAttachment['annotations']): number {
  const regions = toClaudeRegions(parseAnnotations(annotations))
  if (regions.length === 0) return 50
  let left = 1
  let right = 0
  for (const r of regions) {
    const reach = r.kind === 'pin' ? PIN_REACH : 0
    left = Math.min(left, r.x - reach)
    right = Math.max(right, r.x + r.w + reach)
  }
  const after = Math.round((right + SUBJECT_GAP) * 100)
  if (after <= 100 - EDGE_MIN) return Math.max(EDGE_MIN, after)
  const before = Math.round((left - SUBJECT_GAP) * 100)
  if (before >= EDGE_MIN) return before
  return 50
}
