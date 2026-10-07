import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import Onboarding from './Onboarding'

vi.mock('../hooks/useWorkspaces', () => ({
  setLastWorkspace: vi.fn(),
  useWorkspaces: () => ({
    createWorkspace: vi.fn(),
    joinWorkspace: vi.fn().mockRejectedValue(new Error("That invite code doesn't exist.")),
  }),
}))

describe('Onboarding', () => {
  it('shows an invite-code error on the invite field only', async () => {
    render(
      <MemoryRouter>
        <Onboarding />
      </MemoryRouter>,
    )
    fireEvent.change(screen.getByLabelText('Invite code'), { target: { value: 'abcd1234' } })
    fireEvent.click(screen.getByRole('button', { name: 'Join' }))
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent("That invite code doesn't exist.")
    await waitFor(() => {
      expect(screen.getByLabelText('Invite code').getAttribute('aria-describedby')).toContain(
        alert.id,
      )
    })
    expect(
      screen.getByLabelText('Workspace name').getAttribute('aria-describedby') ?? '',
    ).not.toContain(alert.id)
  })
})
