import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import Join from './Join'

const rpc = vi.fn()

vi.mock('../lib/supabase', () => ({
  supabase: { rpc: (...args: unknown[]) => rpc(...args) },
}))

vi.mock('../lib/auth', () => ({
  useAuth: () => ({ user: null, loading: false }),
}))

vi.mock('../hooks/useWorkspaces', () => ({
  friendlyError: (e: { message: string }) => e.message,
  setLastWorkspace: vi.fn(),
  useWorkspaces: () => ({ joinWorkspace: vi.fn() }),
}))

function renderJoin() {
  return render(
    <MemoryRouter initialEntries={['/join/abcd1234']}>
      <Routes>
        <Route path="/join/:code" element={<Join />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('Join', () => {
  beforeEach(() => rpc.mockReset())

  it('shows the invalid-invite state when the preview RPC returns null data', async () => {
    rpc.mockResolvedValue({ data: null, error: null })
    renderJoin()
    expect(await screen.findByRole('alert')).toHaveTextContent("That invite code doesn't exist.")
    expect(rpc).toHaveBeenCalledWith('workspace_preview', { p_code: 'abcd1234' })
  })

  it('shows the invalid-invite state for an empty result', async () => {
    rpc.mockResolvedValue({ data: [], error: null })
    renderJoin()
    expect(await screen.findByRole('alert')).toHaveTextContent("That invite code doesn't exist.")
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
})
