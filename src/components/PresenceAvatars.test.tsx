import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import type { WorkspaceMember } from '../lib/types'
import { PresenceAvatars } from './PresenceAvatars'

function member(name: string): WorkspaceMember {
  const id = name.toLowerCase()
  return {
    workspace_id: 'ws',
    user_id: id,
    role: 'member',
    joined_at: '2026-10-01T10:00:00Z',
    profile: {
      id,
      display_name: name,
      avatar_url: null,
      avatar_color: '#7c3aed',
      created_at: '2026-10-01T10:00:00Z',
    },
  }
}

const members = ['Ada', 'Grace', 'Linus', 'Margaret', 'Ken', 'Barbara', 'Me'].map(member)
const presence = (id: string) => ({ user_id: id, viewing: null, online_at: '2026-10-01T10:00:00Z' })

afterEach(cleanup)

describe('PresenceAvatars', () => {
  it('renders nothing when only self is online', () => {
    const { container } = render(
      <PresenceAvatars online={[presence('me')]} members={members} selfId="me" />,
    )
    expect(container.firstChild).toBeNull()
  })

  it('labels the group with the count and names, excluding self, unknown and duplicate users', () => {
    render(
      <PresenceAvatars
        online={['me', 'ada', 'grace', 'ada', 'stranger'].map(presence)}
        members={members}
        selfId="me"
      />,
    )
    expect(screen.getByRole('group', { name: '2 online: Ada, Grace' })).toBeInTheDocument()
    expect(screen.getByTitle('Ada')).toBeInTheDocument()
    expect(screen.getByTitle('Grace')).toBeInTheDocument()
  })

  it('collapses users beyond the visible limit into a +N chip naming them', () => {
    render(
      <PresenceAvatars
        online={['ada', 'grace', 'linus', 'margaret', 'ken', 'barbara'].map(presence)}
        members={members}
        selfId="me"
      />,
    )
    expect(screen.getByText('+2')).toHaveAttribute('title', 'Ken, Barbara')
    expect(screen.getByRole('group')).toHaveAccessibleName(/^6 online: /)
  })
})
