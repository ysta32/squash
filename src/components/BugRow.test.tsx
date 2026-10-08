import { Profiler } from 'react'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { BugWithMeta, WorkspaceMember } from '../lib/types'
import type * as AvatarModule from './Avatar'
import type { AvatarProps } from './Avatar'
import { BugRow } from './BugRow'
import type { BugRowProps } from './BugRow'

const { onRowRender } = vi.hoisted(() => ({ onRowRender: vi.fn() }))

vi.mock('./Avatar', async (importOriginal) => {
  const { Avatar } = await importOriginal<typeof AvatarModule>()
  return {
    Avatar: (props: AvatarProps) => (
      <Profiler id="row-content" onRender={onRowRender}>
        <Avatar {...props} />
      </Profiler>
    ),
  }
})

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
  it('skips rendering for equivalent viewers but renders when row props change', () => {
    const props: BugRowProps = {
      bug: bug(),
      selected: false,
      onSelect: vi.fn(),
      members,
      viewers: [{ user_id: 'ada', viewing: 'b1', online_at: '2026-10-01T10:00:00Z' }],
      highlighted: false,
      picked: false,
      onTogglePick: vi.fn(),
    }
    function Parent({
      revision,
      picked = false,
      viewers = props.viewers,
      bug = props.bug,
    }: {
      revision: number
      picked?: boolean
      viewers?: BugRowProps['viewers']
      bug?: BugWithMeta
    }) {
      return (
        <div>
          <span>Parent revision {revision}</span>
          <BugRow
            {...props}
            bug={bug}
            viewers={viewers.map((viewer) => ({ ...viewer }))}
            picked={picked}
          />
        </div>
      )
    }

    // One Avatar (the filer) renders per row render; viewers show as an eye and count.
    onRowRender.mockClear()
    const { rerender } = render(<Parent revision={0} />)
    expect(onRowRender).toHaveBeenCalledTimes(1)

    rerender(<Parent revision={1} />)
    expect(screen.getByText('Parent revision 1')).toBeInTheDocument()
    expect(onRowRender).toHaveBeenCalledTimes(1)

    rerender(<Parent revision={2} picked />)
    expect(onRowRender).toHaveBeenCalledTimes(2)
    expect(screen.getByLabelText('Picked')).toBeInTheDocument()

    const viewers = [...props.viewers, { ...props.viewers[0], user_id: 'grace' }]
    rerender(<Parent revision={3} picked viewers={viewers} />)
    expect(onRowRender).toHaveBeenCalledTimes(3)
    expect(screen.getByTitle('Ada and Grace are viewing')).toBeInTheDocument()

    rerender(
      <Parent
        revision={4}
        picked
        viewers={viewers}
        bug={{ ...props.bug, title: 'Updated login' }}
      />,
    )
    expect(onRowRender).toHaveBeenCalledTimes(4)
    expect(screen.getByRole('option', { name: '#1 Updated login' })).toBeInTheDocument()
  })

  it('shows the assignee in the trailing person slot after the time, instead of the filer', () => {
    row(bug({ assignee_id: 'grace' }))
    const assignee = screen.getByTitle('Assigned to Grace')
    expect(assignee).toContainElement(screen.getByLabelText('Grace'))
    expect(assignee.previousElementSibling).toBe(screen.getByRole('option').querySelector('time'))
    expect(assignee.nextElementSibling).toBeNull()
    expect(screen.queryByTitle(/Filed by/)).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Ada')).not.toBeInTheDocument()
  })

  it('shows the filer when the bug is unassigned', () => {
    row(bug())
    expect(screen.queryByTitle(/Assigned to/)).not.toBeInTheDocument()
    const filer = screen.getByTitle('Filed by Ada')
    expect(filer).toContainElement(screen.getByLabelText('Ada'))
    expect(filer.previousElementSibling).toBe(screen.getByRole('option').querySelector('time'))
    expect(filer.nextElementSibling).toBeNull()
  })
})
