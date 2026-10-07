import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { BugWithMeta, WorkspaceMember } from '../lib/types'
import { BugRow } from './BugRow'

vi.mock('../hooks/useSignedUrl', () => ({ useSignedUrl: () => null }))

const members: WorkspaceMember[] = ['Ada', 'Grace'].map((name) => ({
  workspace_id: 'ws',
  user_id: name.toLowerCase(),
  role: 'member',
  joined_at: '2026-10-01T10:00:00Z',
  profile: {
    id: name.toLowerCase(),
    display_name: name,
    avatar_url: null,
    avatar_color: '#7c3aed',
    created_at: '2026-10-01T10:00:00Z',
  },
}))

function bug(over: Partial<BugWithMeta> = {}): BugWithMeta {
  return {
    id: 'b1',
    workspace_id: 'ws',
    number: 1,
    title: 'Broken login',
    description: '',
    transcript: null,
    severity: 'high',
    status: 'open',
    kind: 'bug',
    filed_by: 'ada',
    created_at: '2026-10-01T10:00:00Z',
    resolved_by: null,
    resolved_at: null,
    resolution_note: null,
    assignee_id: null,
    updated_at: '2026-10-01T10:00:00Z',
    attachments: [],
    ...over,
  }
}

function row(b: BugWithMeta) {
  return render(
    <BugRow
      bug={b}
      selected={false}
      onSelect={vi.fn()}
      members={members}
      viewers={[]}
      highlighted={false}
    />,
  )
}

afterEach(cleanup)

describe('BugRow', () => {
  it('shows the assignee avatar before the time', () => {
    row(bug({ assignee_id: 'grace' }))
    const assignee = screen.getByTitle('Assigned to Grace')
    expect(assignee).toContainElement(screen.getByLabelText('Grace'))
    const time = screen.getByRole('option').querySelector('time')
    expect(assignee.nextElementSibling).toBe(time)
  })

  it('shows nothing for an unassigned bug', () => {
    row(bug())
    expect(screen.queryByTitle(/Assigned to/)).not.toBeInTheDocument()
  })
})
