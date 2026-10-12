import { afterEach, describe, expect, it } from 'vitest'
import type { BugWithMeta } from './types'
import { UPDATES_MAX, isNewUpdate, loadReview, markSeen, saveReview, updateItems } from './updates'

function bug(id: string, overrides: Partial<BugWithMeta> = {}): BugWithMeta {
  return {
    id,
    workspace_id: 'w',
    number: Number(id.replace(/\D/g, '')) || 1,
    title: `Item ${id}`,
    description: '',
    transcript: null,
    severity: 'medium',
    status: 'resolved',
    kind: 'bug',
    filed_by: 'u',
    created_at: '2026-10-01T10:00:00Z',
    resolved_by: 'u',
    resolved_at: '2026-10-10T10:00:00Z',
    resolution_note: 'Done',
    updated_at: '2026-10-10T10:00:00Z',
    assignee_id: null,
    attachments: [],
    ...overrides,
  }
}

const now = new Date('2026-10-12T10:00:00Z')
const review = { since: '2026-10-09T00:00:00Z', seen: {} }

describe('updates', () => {
  afterEach(() => localStorage.clear())

  it('lists recent resolutions newest first, and skips open, old and optimistic items', () => {
    const items = updateItems(
      [
        bug('b1', { resolved_at: '2026-10-10T10:00:00Z' }),
        bug('b2', { resolved_at: '2026-10-11T10:00:00.000+00:00' }),
        bug('b3', { status: 'open', resolved_at: null }),
        bug('b4', { resolved_at: '2026-08-01T10:00:00Z' }),
        bug('b5', { optimistic: true }),
      ],
      review,
      now,
    )
    expect(items.map((i) => i.bug.id)).toEqual(['b2', 'b1'])
    expect(items.every((i) => i.isNew)).toBe(true)
  })

  it('caps the list', () => {
    const many = Array.from({ length: UPDATES_MAX + 5 }, (_, i) => bug(`b${i + 1}`))
    expect(updateItems(many, review, now)).toHaveLength(UPDATES_MAX)
  })

  it('never counts resolutions from before the person started as new', () => {
    expect(isNewUpdate(bug('b1', { resolved_at: '2026-10-08T00:00:00Z' }), review)).toBe(false)
  })

  it('marks an item reviewed until it is resolved again', () => {
    const item = bug('b1')
    const reviewed = markSeen(review, [item])
    expect(isNewUpdate(item, reviewed)).toBe(false)
    expect(isNewUpdate({ ...item, resolved_at: '2026-10-11T12:00:00Z' }, reviewed)).toBe(true)
    expect(markSeen(reviewed, [item])).toBe(reviewed)
  })

  it('treats an item you resolved here as reviewed despite clock skew', () => {
    const reviewed = markSeen(
      review,
      [{ id: 'b1', resolved_at: null }],
      new Date('2026-10-10T10:00:00Z'),
    )
    expect(isNewUpdate(bug('b1', { resolved_at: '2026-10-10T10:00:30Z' }), reviewed)).toBe(false)
    expect(isNewUpdate(bug('b1', { resolved_at: '2026-10-10T11:00:00Z' }), reviewed)).toBe(true)
  })

  it('remembers the review per person and workspace', () => {
    const fresh = loadReview('w', 'u', now)
    expect(fresh).toEqual({ since: now.toISOString(), seen: {} })
    saveReview('w', 'u', markSeen(fresh, [bug('b1')]))
    expect(loadReview('w', 'u').seen).toEqual({ b1: '2026-10-10T10:00:00Z' })
    expect(loadReview('w', 'other', now).seen).toEqual({})
  })

  it('starts fresh when the stored review is unreadable', () => {
    localStorage.setItem('squash:updates:u:w', '{"since":5}')
    expect(loadReview('w', 'u', now)).toEqual({ since: now.toISOString(), seen: {} })
  })
})
