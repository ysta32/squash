import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Onboarding from './Onboarding'

const mocks = vi.hoisted(() => ({
  createWorkspace: vi.fn(),
  joinWorkspace: vi.fn(),
  setLastWorkspace: vi.fn(),
}))

vi.mock('../hooks/useWorkspaces', () => ({
  setLastWorkspace: mocks.setLastWorkspace,
  inviteUrl: (code: string) => `http://localhost/join/${code}`,
  useWorkspaces: () => ({
    createWorkspace: mocks.createWorkspace,
    joinWorkspace: mocks.joinWorkspace,
  }),
}))

function show() {
  render(
    <MemoryRouter initialEntries={['/app']}>
      <Routes>
        <Route path="/app" element={<Onboarding />} />
        <Route path="/app/:id" element={<p>Workspace page</p>} />
      </Routes>
    </MemoryRouter>,
  )
}

afterEach(cleanup)
beforeEach(() => {
  vi.resetAllMocks()
  mocks.joinWorkspace.mockRejectedValue(new Error('That invite code doesn’t exist.'))
})

describe('Onboarding', () => {
  it('shows an invite-code error on the invite field only', async () => {
    show()
    fireEvent.change(screen.getByLabelText('Invite code'), { target: { value: 'abcd2345' } })
    fireEvent.click(screen.getByRole('button', { name: 'Join' }))
    expect(mocks.joinWorkspace).toHaveBeenCalledWith('ABCD2345')
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('That invite code doesn’t exist.')
    await waitFor(() => {
      expect(screen.getByLabelText('Invite code').getAttribute('aria-describedby')).toContain(
        alert.id,
      )
    })
    expect(
      screen.getByLabelText('Workspace name').getAttribute('aria-describedby') ?? '',
    ).not.toContain(alert.id)
  })

  it('accepts a pasted invite link and joins with its code', async () => {
    mocks.joinWorkspace.mockResolvedValue({ id: 'ws9', name: 'Lumen' })
    show()
    const input = screen.getByLabelText('Invite code')
    fireEvent.change(input, { target: { value: 'https://squash.example/join/K3X9LMNP' } })
    expect(input).toHaveValue('K3X9LMNP')
    fireEvent.click(screen.getByRole('button', { name: 'Join' }))
    expect(await screen.findByText('Workspace page')).toBeInTheDocument()
    expect(mocks.joinWorkspace).toHaveBeenCalledWith('K3X9LMNP')
    expect(mocks.setLastWorkspace).toHaveBeenCalledWith('ws9')
  })

  it('keeps Join off until the code can be valid and explains impossible characters', () => {
    show()
    const input = screen.getByLabelText('Invite code')
    const join = screen.getByRole('button', { name: 'Join' })
    fireEvent.change(input, { target: { value: 'K3X9' } })
    expect(join).toBeDisabled()
    expect(input).not.toHaveAttribute('aria-invalid')
    fireEvent.change(input, { target: { value: 'K3X9LMN0' } })
    expect(join).toBeDisabled()
    expect(input).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByText(/without 0, 1, I or O/)).toBeInTheDocument()
    fireEvent.click(join)
    expect(mocks.joinWorkspace).not.toHaveBeenCalled()
  })

  it('names every setup step and marks only the current one', () => {
    show()
    const steps = screen.getByRole('list', { name: 'Setup steps' })
    expect(steps).toHaveTextContent('01Name it')
    expect(steps).toHaveTextContent('02Invite')
    expect(steps).toHaveTextContent('03First bug')
    expect(steps.querySelectorAll('[aria-current="step"]')).toHaveLength(1)
  })

  it('walks through name, invite and first bug as steps 01 / 02 / 03', async () => {
    mocks.createWorkspace.mockResolvedValue({
      id: 'ws1',
      name: 'Acme',
      owner_id: 'me',
      invite_code: 'ABCD1234',
      created_at: '',
    })
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } })
    show()
    const steps = () => screen.getByRole('list', { name: 'Setup steps' })
    expect(steps().querySelector('[aria-current="step"]')).toHaveTextContent('01')
    fireEvent.change(screen.getByLabelText('Workspace name'), { target: { value: 'Acme' } })
    fireEvent.click(screen.getByRole('button', { name: 'Create workspace' }))

    expect(await screen.findByRole('heading', { name: 'Invite a teammate' })).toBeInTheDocument()
    expect(mocks.createWorkspace).toHaveBeenCalledWith('Acme')
    expect(mocks.setLastWorkspace).toHaveBeenCalledWith('ws1')
    expect(steps().querySelector('[aria-current="step"]')).toHaveTextContent('02')
    fireEvent.click(screen.getByRole('button', { name: 'Copy link' }))
    expect(await screen.findByRole('button', { name: 'Copied' })).toBeInTheDocument()
    expect(writeText).toHaveBeenCalledWith('http://localhost/join/ABCD1234')
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))

    expect(screen.getByRole('heading', { name: 'File your first bug' })).toBeInTheDocument()
    expect(steps().querySelector('[aria-current="step"]')).toHaveTextContent('03')
    fireEvent.click(screen.getByRole('button', { name: 'Open Acme' }))
    expect(screen.getByText('Workspace page')).toBeInTheDocument()
  })
})
