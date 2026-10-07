import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DeletionLog } from './DeletionLog'

const state = vi.hoisted(() => ({
  value: { deletions: [] as unknown[], loading: false, error: null as string | null },
}))
vi.mock('../../hooks/useDeletionLog', () => ({ useDeletionLog: () => state.value }))

const members = [{ user_id: 'u1', profile: { display_name: 'Ada' } }]
const row = (id: string, n: number, by: string | null) => ({
  id,
  workspace_id: 'ws',
  bug_number: n,
  title: `Title ${n}`,
  kind: 'bug',
  deleted_by: by,
  deleted_at: new Date().toISOString(),
})

beforeEach(() => {
  state.value = { deletions: [], loading: false, error: null }
})

describe('DeletionLog', () => {
  it('lists rows with the deleter name or "Deleted user"', () => {
    state.value.deletions = [row('a', 7, 'u1'), row('b', 4, 'gone'), row('c', 2, null)]
    render(<DeletionLog workspaceId="ws" members={members} />)
    expect(screen.getByText('#7')).toBeInTheDocument()
    expect(screen.getByText('Title 7')).toBeInTheDocument()
    expect(screen.getByText(/^Ada ·/)).toBeInTheDocument()
    expect(screen.getAllByText(/^Deleted user ·/)).toHaveLength(2)
    expect(screen.getByText(/Deleted bugs are removed for good/)).toBeInTheDocument()
    const time = document.querySelector('time')
    expect(time).toHaveAttribute(
      'datetime',
      (state.value.deletions[0] as { deleted_at: string }).deleted_at,
    )
    expect(time).toHaveAttribute(
      'title',
      new Date((state.value.deletions[0] as { deleted_at: string }).deleted_at).toLocaleString(),
    )
  })

  it('shows an empty state', () => {
    render(<DeletionLog workspaceId="ws" members={members} />)
    expect(screen.getByText('Nothing has been deleted.')).toBeInTheDocument()
  })

  it('shows loading and error states', () => {
    state.value = { deletions: [], loading: true, error: null }
    const { rerender } = render(<DeletionLog workspaceId="ws" members={members} />)
    expect(screen.getByRole('status')).toHaveTextContent('Loading')
    state.value = { deletions: [], loading: false, error: 'denied' }
    rerender(<DeletionLog workspaceId="ws" members={members} />)
    expect(screen.getByRole('alert')).toHaveTextContent('denied')
  })
})
