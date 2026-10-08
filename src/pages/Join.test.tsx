import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Join from './Join'

const rpc = vi.fn()

vi.mock('../lib/supabase', () => ({
  supabase: { rpc: (...args: unknown[]) => rpc(...args) },
}))

const state = vi.hoisted(() => ({
  user: null as object | null,
  joinWorkspace: vi.fn(),
  setLastWorkspace: vi.fn(),
}))

vi.mock('../lib/auth', () => ({
  useAuth: () => ({ user: state.user, loading: false }),
}))

vi.mock('../hooks/useWorkspaces', () => ({
  friendlyError: (e: { message: string }) => e.message,
  setLastWorkspace: (...args: unknown[]) => state.setLastWorkspace(...args),
  useWorkspaces: () => ({ joinWorkspace: state.joinWorkspace }),
}))

function renderJoin() {
  return render(
    <MemoryRouter initialEntries={['/join/abcd1234']}>
      <Routes>
        <Route path="/join/:code" element={<Join />} />
        <Route path="/app/:id" element={<p>Workspace page</p>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('Join', () => {
  afterEach(cleanup)
  beforeEach(() => {
    rpc.mockReset()
    state.user = null
    state.joinWorkspace.mockReset()
    state.setLastWorkspace.mockReset()
  })

  it('shows the invalid-invite state when the preview RPC returns null data', async () => {
    rpc.mockResolvedValue({ data: null, error: null })
    renderJoin()
    expect(await screen.findByRole('alert')).toHaveTextContent('That invite code doesn’t exist.')
    expect(rpc).toHaveBeenCalledWith('workspace_preview', { p_code: 'abcd1234' })
  })

  it('shows the invalid-invite state for an empty result', async () => {
    rpc.mockResolvedValue({ data: [], error: null })
    renderJoin()
    expect(await screen.findByRole('alert')).toHaveTextContent('That invite code doesn’t exist.')
  })

  it('previews the workspace and offers sign-in when signed out', async () => {
    rpc.mockResolvedValue({ data: [{ id: 'w1', name: 'Acme', member_count: 1 }], error: null })
    renderJoin()
    expect(await screen.findByRole('heading', { name: 'Join Acme' })).toBeInTheDocument()
    expect(screen.getByText(/It has 1 member\./)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Sign in to join' })).toHaveAttribute(
      'href',
      '/signin?next=%2Fjoin%2Fabcd1234',
    )
  })

  it('shows the friendly error and a way home when the RPC fails', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'boom' } })
    renderJoin()
    expect(await screen.findByRole('alert')).toHaveTextContent('boom')
    expect(screen.getByRole('link', { name: 'Back to home' })).toHaveAttribute('href', '/')
    expect(screen.queryByRole('link', { name: 'Sign in to join' })).not.toBeInTheDocument()
  })

  it('pluralises the member count', async () => {
    rpc.mockResolvedValue({ data: [{ id: 'w1', name: 'Acme', member_count: 3 }], error: null })
    renderJoin()
    expect(await screen.findByText(/It has 3 members\./)).toBeInTheDocument()
  })

  it('auto-joins a signed-in user, remembers the workspace and navigates to it', async () => {
    state.user = { id: 'u1' }
    state.joinWorkspace.mockResolvedValue({ id: 'w1' })
    rpc.mockResolvedValue({ data: [{ id: 'w1', name: 'Acme', member_count: 2 }], error: null })
    renderJoin()
    expect(await screen.findByText('Workspace page')).toBeInTheDocument()
    expect(state.joinWorkspace).toHaveBeenCalledTimes(1)
    expect(state.joinWorkspace).toHaveBeenCalledWith('abcd1234')
    expect(state.setLastWorkspace).toHaveBeenCalledWith('w1')
  })

  it('shows the join error when joining fails', async () => {
    state.user = { id: 'u1' }
    state.joinWorkspace.mockRejectedValue(new Error('Workspace is full'))
    rpc.mockResolvedValue({ data: [{ id: 'w1', name: 'Acme', member_count: 2 }], error: null })
    renderJoin()
    expect(await screen.findByRole('alert')).toHaveTextContent('Workspace is full')
    expect(state.setLastWorkspace).not.toHaveBeenCalled()
  })
})
