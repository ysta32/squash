import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { WorkspaceSettings, type WorkspaceSection } from './WorkspaceSettings'
import { resetAutosaveLines } from './useAutosave'

const mocks = vi.hoisted(() => {
  const profile = (id: string, name: string) => ({
    id,
    display_name: name,
    avatar_url: null,
    avatar_color: '#ef4444',
    created_at: '',
  })
  return {
    workspace: { id: 'ws', name: 'Acme', owner_id: 'self', invite_code: 'OLDCODE', created_at: '' },
    members: [
      {
        workspace_id: 'ws',
        user_id: 'self',
        role: 'owner',
        joined_at: '',
        profile: profile('self', 'Ada'),
      },
      {
        workspace_id: 'ws',
        user_id: 'other',
        role: 'member',
        joined_at: '',
        profile: profile('other', 'Grace'),
      },
    ],
    state: { role: 'owner', loading: false, notFound: false },
    rename: vi.fn(),
    regenerateInviteCode: vi.fn(),
    removeMember: vi.fn(),
    deleteWorkspace: vi.fn(),
    removeScreenshots: vi.fn(),
  }
})

vi.mock('../../hooks/useWorkspaces', () => ({
  LAST_WORKSPACE_KEY: 'squash:lastWorkspace',
  inviteUrl: (code: string) => `http://localhost/join/${code}`,
  useWorkspace: () => ({
    workspace: mocks.state.notFound ? null : mocks.workspace,
    members: mocks.members,
    role: mocks.state.role,
    loading: mocks.state.loading,
    notFound: mocks.state.notFound,
    rename: mocks.rename,
    regenerateInviteCode: mocks.regenerateInviteCode,
    removeMember: mocks.removeMember,
    deleteWorkspace: mocks.deleteWorkspace,
  }),
}))
vi.mock('./DeletionLog', () => ({ DeletionLog: () => null }))
vi.mock('../../lib/storageCleanup', () => ({
  removeScreenshots: (...args: unknown[]) => mocks.removeScreenshots(...args),
}))

function show(section: WorkspaceSection = 'workspace') {
  render(
    <MemoryRouter initialEntries={['/app/ws/settings']}>
      <Routes>
        <Route
          path="/app/ws/settings"
          element={<WorkspaceSettings workspaceId="ws" section={section} />}
        />
        <Route path="/app" element={<p>Workspace picker</p>} />
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.resetAllMocks()
  resetAutosaveLines()
  mocks.state.role = 'owner'
  mocks.state.loading = false
  mocks.state.notFound = false
  mocks.rename.mockResolvedValue(undefined)
  mocks.regenerateInviteCode.mockResolvedValue('NEWCODE')
  mocks.removeMember.mockResolvedValue(undefined)
  mocks.deleteWorkspace.mockResolvedValue(undefined)
  mocks.removeScreenshots.mockResolvedValue(undefined)
  localStorage.setItem('squash:lastWorkspace', 'ws')
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', {
    configurable: true,
    value: function (this: HTMLDialogElement) {
      this.open = true
    },
  })
})
afterEach(() => {
  cleanup()
  localStorage.clear()
})

describe('WorkspaceSettings', () => {
  it('shows loading and unavailable states', () => {
    mocks.state.loading = true
    show()
    expect(screen.getByRole('status')).toHaveTextContent('Loading workspace')
    cleanup()
    mocks.state.loading = false
    mocks.state.notFound = true
    show()
    expect(screen.getByRole('alert')).toHaveTextContent('Workspace unavailable.')
  })

  it('is read-only for non-owners', () => {
    mocks.state.role = 'member'
    show()
    expect(screen.getByText('Only the owner can change workspace settings')).toBeInTheDocument()
    expect(screen.queryByRole('textbox', { name: 'Workspace name' })).not.toBeInTheDocument()
    for (const section of ['workspace', 'members', 'danger'] as const) {
      cleanup()
      show(section)
      expect(screen.queryByRole('button', { name: 'Regenerate' })).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Delete workspace' })).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: /^Remove/ })).not.toBeInTheDocument()
    }
  })

  it('renames with a trimmed name when the field is left, and confirms inline', async () => {
    show()
    const name = screen.getByLabelText('Workspace name')
    fireEvent.change(name, { target: { value: '  Beta  ' } })
    fireEvent.blur(name)
    await waitFor(() => expect(mocks.rename).toHaveBeenCalledWith('Beta'))
    expect(await screen.findByText('Saved')).toBeInTheDocument()
    expect(name).toHaveValue('Beta')
  })

  it('does not rename to a blank name', () => {
    show()
    fireEvent.change(screen.getByLabelText('Workspace name'), { target: { value: '   ' } })
    fireEvent.blur(screen.getByLabelText('Workspace name'))
    expect(screen.getByRole('alert')).toHaveTextContent('Workspace name cannot be empty.')
    expect(mocks.rename).not.toHaveBeenCalled()
  })

  it('reports a failed rename after Escape and rolls the field back', async () => {
    let fail: (error: Error) => void = () => {}
    mocks.rename.mockImplementationOnce(() => new Promise((_, reject) => (fail = reject)))
    show()
    const name = screen.getByLabelText('Workspace name')
    fireEvent.change(name, { target: { value: 'Beta' } })
    fireEvent.blur(name)
    await waitFor(() => expect(mocks.rename).toHaveBeenCalledWith('Beta'))
    fireEvent.change(name, { target: { value: 'Gamma' } })
    fireEvent.keyDown(name, { key: 'Escape' })
    expect(name).toHaveValue('Beta')
    fail(new Error('Name taken'))
    expect(await screen.findByRole('alert')).toHaveTextContent('Name taken')
    expect(name).toHaveValue('Acme')
  })

  it('surfaces rename errors', async () => {
    mocks.rename.mockRejectedValue(new Error('Name taken'))
    show()
    fireEvent.change(screen.getByLabelText('Workspace name'), { target: { value: 'Beta' } })
    fireEvent.blur(screen.getByLabelText('Workspace name'))
    expect(await screen.findByRole('alert')).toHaveTextContent('Name taken')
  })

  it('regenerates the invite code only after confirmation', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
    show()
    fireEvent.click(screen.getByRole('button', { name: 'Regenerate' }))
    expect(mocks.regenerateInviteCode).not.toHaveBeenCalled()
    expect(screen.getByText('OLDCODE')).toBeInTheDocument()
    confirm.mockReturnValue(true)
    fireEvent.click(screen.getByRole('button', { name: 'Regenerate' }))
    expect(await screen.findByText('NEWCODE')).toBeInTheDocument()
    expect(screen.getByText('Invite code regenerated.')).toBeInTheDocument()
    confirm.mockRestore()
  })

  it('copies the full invite link and confirms it', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } })
    show()
    fireEvent.click(screen.getByRole('button', { name: 'Copy link' }))
    expect(await screen.findByRole('button', { name: 'Copied' })).toBeInTheDocument()
    expect(writeText).toHaveBeenCalledWith('http://localhost/join/OLDCODE')
  })

  it('removes a member only after confirmation', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
    show('members')
    expect(screen.queryByRole('button', { name: 'Remove Ada' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Remove Grace' }))
    expect(mocks.removeMember).not.toHaveBeenCalled()
    confirm.mockReturnValue(true)
    fireEvent.click(screen.getByRole('button', { name: 'Remove Grace' }))
    await waitFor(() => expect(mocks.removeMember).toHaveBeenCalledWith('other'))
    expect(await screen.findByText('Member removed.')).toBeInTheDocument()
    confirm.mockRestore()
  })

  it('requires typing the exact workspace name before deleting, then cleans up and redirects', async () => {
    show('danger')
    fireEvent.click(screen.getByRole('button', { name: 'Delete workspace' }))
    const dialog = screen.getByRole('dialog')
    const confirmBtn = dialog.querySelector('button[type="submit"]') as HTMLButtonElement
    expect(confirmBtn).toBeDisabled()
    const input = screen.getByLabelText('Type Acme to confirm')
    fireEvent.change(input, { target: { value: 'acme' } })
    expect(confirmBtn).toBeDisabled()
    fireEvent.change(input, { target: { value: 'Acme' } })
    expect(confirmBtn).toBeEnabled()
    fireEvent.click(confirmBtn)
    expect(await screen.findByText('Workspace picker')).toBeInTheDocument()
    expect(mocks.removeScreenshots).toHaveBeenCalledWith('ws')
    expect(mocks.deleteWorkspace).toHaveBeenCalledTimes(1)
    expect(mocks.removeScreenshots.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.deleteWorkspace.mock.invocationCallOrder[0],
    )
    expect(localStorage.getItem('squash:lastWorkspace')).toBeNull()
  })

  it('cancel closes the delete dialog without deleting', () => {
    show('danger')
    fireEvent.click(screen.getByRole('button', { name: 'Delete workspace' }))
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(mocks.deleteWorkspace).not.toHaveBeenCalled()
  })

  it('shows the error in the dialog and keeps the workspace when deletion fails', async () => {
    mocks.deleteWorkspace.mockRejectedValue(new Error('Delete failed'))
    show('danger')
    fireEvent.click(screen.getByRole('button', { name: 'Delete workspace' }))
    fireEvent.change(screen.getByLabelText('Type Acme to confirm'), { target: { value: 'Acme' } })
    fireEvent.submit(screen.getByRole('dialog').querySelector('form') as HTMLFormElement)
    expect(await screen.findByRole('alert')).toHaveTextContent('Delete failed')
    expect(screen.queryByText('Workspace picker')).not.toBeInTheDocument()
    expect(localStorage.getItem('squash:lastWorkspace')).toBe('ws')
  })
})
