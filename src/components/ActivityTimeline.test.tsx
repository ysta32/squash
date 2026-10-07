import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import type { BugEvent, WorkspaceMember } from '../lib/types'
import { ActivityTimeline } from './ActivityTimeline'

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

function assigned(id: string, actor: string, note: string | null, minute: number): BugEvent {
  return {
    id,
    bug_id: 'b1',
    actor_id: actor,
    type: 'assigned',
    note,
    created_at: `2026-10-01T10:0${minute}:00Z`,
  }
}

afterEach(cleanup)

describe('ActivityTimeline', () => {
  it('describes assignment changes with the assignee resolved to a member name', () => {
    render(
      <ActivityTimeline
        members={members}
        events={[
          assigned('e1', 'ada', 'grace', 1),
          assigned('e2', 'grace', 'grace', 2),
          assigned('e3', 'ada', null, 3),
          assigned('e4', 'ada', '00000000-0000-0000-0000-000000000000', 4),
        ]}
      />,
    )
    const lines = screen.getAllByRole('listitem').map((li) => li.textContent?.split(' · ')[0])
    expect(lines).toEqual([
      'Ada assigned Grace',
      'Grace assigned themselves',
      'Ada removed the assignee',
      'Ada assigned a former member',
    ])
  })
})
