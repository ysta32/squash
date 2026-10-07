import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import Settings from './Settings'

const mocks = vi.hoisted(() => {
  const profile = {
    id: 'self',
    display_name: 'Ada',
    avatar_url: null,
    avatar_color: '#ef4444',
    created_at: '',
  }
  const workspace = {
    id: 'ws',
    name: 'My workspace',
    owner_id: 'self',
    invite_code: 'INVITE',
    created_at: '',
  }
  const members = [
    { workspace_id: 'ws', user_id: 'self', role: 'owner', joined_at: '', profile },
    {
      workspace_id: 'ws',
      user_id: 'other',
      role: 'member',
      joined_at: '',
      profile: { ...profile, id: 'other', display_name: 'Grace' },
    },
  ]
  return {
    profile,
    workspace,
    members,
    role: 'owner',
    refreshProfile: vi.fn(),
    signOut: vi.fn(),
    rename: vi.fn(),
    regenerateInviteCode: vi.fn(),
    removeMember: vi.fn(),
    deleteWorkspace: vi.fn(),
    transferOwnership: vi.fn(),
    refresh: vi.fn(),
    update: vi.fn(),
    eq: vi.fn(),
    list: vi.fn(),
    remove: vi.fn(),
    rpc: vi.fn(),
    ownedWorkspaces: vi.fn(),
    workspaceMembers: vi.fn(),
  }
})
vi.mock('../lib/auth', () => ({
  useAuth: () => ({
    user: { id: 'self' },
    profile: mocks.profile,
    loading: false,
    refreshProfile: mocks.refreshProfile,
    signOut: mocks.signOut,
  }),
}))
vi.mock('../hooks/useWorkspaces', () => ({
  LAST_WORKSPACE_KEY: 'squash:lastWorkspace',
  useWorkspace: () => ({
    workspace: mocks.workspace,
    members: mocks.members,
    role: mocks.role,
    loading: false,
    notFound: false,
    rename: mocks.rename,
    regenerateInviteCode: mocks.regenerateInviteCode,
    removeMember: mocks.removeMember,
    deleteWorkspace: mocks.deleteWorkspace,
    transferOwnership: mocks.transferOwnership,
  }),
  useWorkspaces: () => ({
    workspaces: [mocks.workspace],
    loading: false,
    error: null,
    refresh: mocks.refresh,
  }),
}))
vi.mock('../lib/supabase', () => ({
  supabase: {
    from: (table: string) => ({
      update: mocks.update,
      select: () =>
        table === 'workspaces' ? { eq: mocks.ownedWorkspaces } : { in: mocks.workspaceMembers },
    }),
    storage: { from: () => ({ list: mocks.list, remove: mocks.remove }) },
    rpc: mocks.rpc,
  },
}))

function show(tab = '') {
  render(
    <MemoryRouter initialEntries={[`/app/ws/settings${tab ? `?tab=${tab}` : ''}`]}>
      <Routes>
        <Route path="/app/:workspaceId/settings" element={<Settings />} />
        <Route path="/app" element={<p>Workspace picker</p>} />
        <Route path="/" element={<p>Home</p>} />
      </Routes>
    </MemoryRouter>,
  )
}
function deletionDialog() {
  fireEvent.click(screen.getByRole('button', { name: 'Delete workspace' }))
  return screen.getByRole('dialog')
}

beforeEach(() => {
  vi.resetAllMocks()
  mocks.role = 'owner'
  mocks.update.mockReturnValue({ eq: mocks.eq })
  mocks.eq.mockResolvedValue({ error: null })
  mocks.list.mockResolvedValue({ data: [], error: null })
  mocks.remove.mockResolvedValue({ error: null })
  mocks.rpc.mockResolvedValue({ error: null })
  mocks.ownedWorkspaces.mockResolvedValue({ data: [{ id: 'ws' }], error: null })
  mocks.workspaceMembers.mockResolvedValue({
    data: [{ workspace_id: 'ws', user_id: 'self' }],
    error: null,
  })
  mocks.signOut.mockResolvedValue(undefined)
  mocks.deleteWorkspace.mockResolvedValue(undefined)
  mocks.refreshProfile.mockResolvedValue(undefined)
  mocks.transferOwnership.mockResolvedValue(undefined)
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
  vi.restoreAllMocks()
})

describe('Settings', () => {
  it('honors cancellation before regenerating invites or removing members', () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
    show('workspace')
    fireEvent.click(screen.getByRole('button', { name: 'Regenerate' }))
    fireEvent.click(screen.getByRole('button', { name: 'Remove Grace' }))
    expect(confirm).toHaveBeenCalledTimes(2)
    expect(mocks.regenerateInviteCode).not.toHaveBeenCalled()
    expect(mocks.removeMember).not.toHaveBeenCalled()
  })

  it('collects all storage pages before removing files in batches', async () => {
    const firstPage = Array.from({ length: 100 }, (_, index) => ({
      name: `image-${index}.png`,
      id: `file-${index}`,
    }))
    mocks.list.mockImplementation(async (prefix: string, options: { offset: number }) => {
      expect(mocks.remove).not.toHaveBeenCalled()
      return {
        data:
          prefix === 'ws'
            ? [{ name: 'bug', id: null }]
            : options.offset === 0
              ? firstPage
              : [{ name: 'last.png', id: 'last' }],
        error: null,
      }
    })
    show('workspace')
    const dialog = deletionDialog()
    fireEvent.change(within(dialog).getByRole('textbox'), { target: { value: 'My workspace' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Delete workspace' }))
    await screen.findByText('Workspace picker')
    expect(mocks.list).toHaveBeenCalledWith('ws/bug', expect.objectContaining({ offset: 100 }))
    expect(mocks.remove).toHaveBeenNthCalledWith(
      1,
      firstPage.map((file) => `ws/bug/${file.name}`),
    )
    expect(mocks.remove).toHaveBeenNthCalledWith(2, ['ws/bug/last.png'])
  })

  it('preserves the workspace and last selection when removing storage objects fails', async () => {
    localStorage.setItem('squash:lastWorkspace', 'ws')
    mocks.list.mockResolvedValue({ data: [{ name: 'image.png', id: 'file' }], error: null })
    mocks.remove.mockResolvedValue({ error: { message: 'Remove failed' } })
    show('workspace')
    const dialog = deletionDialog()
    fireEvent.change(within(dialog).getByRole('textbox'), { target: { value: 'My workspace' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Delete workspace' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Remove failed')
    expect(mocks.deleteWorkspace).not.toHaveBeenCalled()
    expect(localStorage.getItem('squash:lastWorkspace')).toBe('ws')
  })

  it('shows account deletion errors without signing out', async () => {
    mocks.rpc.mockResolvedValue({ error: { message: 'Account deletion unavailable' } })
    show('account')
    fireEvent.click(screen.getByRole('button', { name: 'Delete account' }))
    fireEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete account' }),
    )
    expect(await screen.findByRole('alert')).toHaveTextContent('Account deletion unavailable')
    expect(mocks.signOut).not.toHaveBeenCalled()
  })

  it('renders tabs, defaults to profile, and switches panels', () => {
    show()
    const tabs = screen.getByRole('navigation', { name: 'Settings tabs' })
    expect(within(tabs).getAllByRole('button')).toHaveLength(4)
    expect(screen.getByLabelText('Display name')).toHaveValue('Ada')
    fireEvent.click(within(tabs).getByRole('button', { name: 'workspace' }))
    expect(screen.getByLabelText('Workspace name')).toHaveValue('My workspace')
    fireEvent.click(within(tabs).getByRole('button', { name: 'account' }))
    expect(screen.getByRole('button', { name: 'Sign out' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Back to workspace' })).toHaveAttribute(
      'href',
      '/app/ws',
    )
  })

  it('shows read-only workspace information to non-owners', () => {
    mocks.role = 'member'
    show('workspace')
    expect(screen.getByText('Only the owner can change workspace settings')).toBeInTheDocument()
    expect(screen.getByText('Grace')).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /Delete workspace|Remove|Regenerate|Save/ }),
    ).not.toBeInTheDocument()
  })

  it('requires the exact workspace name before deletion', () => {
    show('workspace')
    const dialog = deletionDialog()
    const remove = within(dialog).getByRole('button', { name: 'Delete workspace' })
    const input = within(dialog).getByLabelText('Type My workspace to confirm')
    expect(remove).toBeDisabled()
    fireEvent.change(input, { target: { value: 'my workspace' } })
    expect(remove).toBeDisabled()
    fireEvent.change(input, { target: { value: 'My workspace ' } })
    expect(remove).toBeDisabled()
    fireEvent.change(input, { target: { value: 'My workspace' } })
    expect(remove).toBeEnabled()
  })

  it('saves profile name and palette color and refreshes the profile', async () => {
    show()
    fireEvent.change(screen.getByLabelText('Display name'), {
      target: { value: '  Ada Lovelace  ' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Avatar color #0f766e' }))
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await screen.findByText('Profile saved.')
    expect(mocks.update).toHaveBeenCalledWith({
      display_name: 'Ada Lovelace',
      avatar_color: '#0f766e',
    })
    expect(mocks.eq).toHaveBeenCalledWith('id', 'self')
    expect(mocks.refreshProfile).toHaveBeenCalledOnce()
  })

  it('enables profile save only for changes and clears the saved state briefly after success', async () => {
    show()
    const name = screen.getByLabelText('Display name')
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
    fireEvent.change(name, { target: { value: 'Ada changed' } })
    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled()
    fireEvent.change(name, { target: { value: 'Ada' } })
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
    fireEvent.change(name, { target: { value: 'Ada changed' } })
    vi.useFakeTimers()
    try {
      await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Save' })))
      expect(screen.getByRole('button', { name: 'Saved' })).toBeDisabled()
      act(() => vi.advanceTimersByTime(2500))
      expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
    } finally {
      vi.useRealTimers()
    }
  })

  it('keeps a failed profile save dirty and available to retry', async () => {
    mocks.eq.mockResolvedValue({ error: { message: 'Update failed' } })
    show()
    fireEvent.change(screen.getByLabelText('Display name'), { target: { value: 'New name' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Update failed')
    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled()
    expect(mocks.refreshProfile).not.toHaveBeenCalled()
  })

  it('enables workspace save only when dirty and resets it after saving', async () => {
    show('workspace')
    const name = screen.getByLabelText('Workspace name')
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
    fireEvent.change(name, { target: { value: 'Team workspace' } })
    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled()
    fireEvent.change(name, { target: { value: 'My workspace' } })
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
    fireEvent.change(name, { target: { value: 'Team workspace' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(await screen.findByRole('button', { name: 'Saved' })).toBeDisabled()
    expect(mocks.rename).toHaveBeenCalledWith('Team workspace')
    fireEvent.change(name, { target: { value: 'Another workspace' } })
    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled()
  })

  it('offers a workspace picker link when no workspace is selected', () => {
    render(
      <MemoryRouter initialEntries={['/settings?tab=workspace']}>
        <Settings />
      </MemoryRouter>,
    )
    expect(screen.getByRole('heading', { name: 'Choose a workspace' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Choose workspace' })).toHaveAttribute('href', '/app')
  })

  it('exposes native radio groups for mode and scheme', () => {
    show('appearance')
    const modes = screen.getByRole('radiogroup', { name: 'Mode' })
    expect(within(modes).getAllByRole('radio')).toHaveLength(3)
    fireEvent.click(within(modes).getByRole('radio', { name: 'Dark' }))
    expect(within(modes).getByRole('radio', { name: 'Dark' })).toBeChecked()
    expect(localStorage.getItem('squash:theme')).toBe('dark')
    expect(
      within(screen.getByRole('radiogroup', { name: 'Color scheme' })).getAllByRole('radio'),
    ).toHaveLength(6)
  })

  it('recursively removes screenshots before deleting and clears last workspace', async () => {
    localStorage.setItem('squash:lastWorkspace', 'ws')
    mocks.list.mockImplementation(async (prefix: string) => ({
      data: prefix === 'ws' ? [{ name: 'bug', id: null }] : [{ name: 'image.png', id: 'file' }],
      error: null,
    }))
    mocks.deleteWorkspace.mockImplementation(async () => {
      expect(mocks.remove).toHaveBeenCalledWith(['ws/bug/image.png'])
    })
    show('workspace')
    const dialog = deletionDialog()
    fireEvent.change(within(dialog).getByRole('textbox'), { target: { value: 'My workspace' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Delete workspace' }))
    await screen.findByText('Workspace picker')
    expect(mocks.deleteWorkspace).toHaveBeenCalledOnce()
    expect(localStorage.getItem('squash:lastWorkspace')).toBeNull()
  })

  it('does not delete the workspace if screenshot cleanup fails', async () => {
    mocks.list.mockResolvedValue({ data: null, error: { message: 'Storage unavailable' } })
    show('workspace')
    const dialog = deletionDialog()
    fireEvent.change(within(dialog).getByRole('textbox'), { target: { value: 'My workspace' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Delete workspace' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Storage unavailable')
    expect(mocks.deleteWorkspace).not.toHaveBeenCalled()
  })

  it('removes screenshots of solo-owned workspaces before deleting the account', async () => {
    mocks.list.mockResolvedValue({ data: [{ name: 'shot.png', id: 'file' }], error: null })
    mocks.rpc.mockImplementation(async () => {
      expect(mocks.remove).toHaveBeenCalledWith(['ws/shot.png'])
      return { error: null }
    })
    show('account')
    fireEvent.click(screen.getByRole('button', { name: 'Delete account' }))
    fireEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete account' }),
    )
    await screen.findByText('Home')
    expect(mocks.ownedWorkspaces).toHaveBeenCalledWith('owner_id', 'self')
    expect(mocks.workspaceMembers).toHaveBeenCalledWith('workspace_id', ['ws'])
    expect(mocks.rpc).toHaveBeenCalledWith('delete_account')
  })

  it('offers ownership transfer after the RPC rejects account deletion, then retries', async () => {
    mocks.workspaceMembers.mockResolvedValueOnce({
      data: [
        { workspace_id: 'ws', user_id: 'self' },
        { workspace_id: 'ws', user_id: 'other' },
      ],
      error: null,
    })
    mocks.rpc
      .mockResolvedValueOnce({ error: { message: 'transfer_ownership_required' } })
      .mockResolvedValue({ error: null })
    show('account')
    fireEvent.click(screen.getByRole('button', { name: 'Delete account' }))
    const dialog = screen.getByRole('dialog')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Delete account' }))
    const select = await screen.findByRole('combobox', { name: 'New owner for My workspace' })
    expect(mocks.signOut).not.toHaveBeenCalled()
    expect(within(select).queryByRole('option', { name: 'Ada' })).not.toBeInTheDocument()
    fireEvent.change(select, { target: { value: 'other' } })
    await waitFor(() => expect(screen.getByRole('button', { name: 'Transfer' })).toBeEnabled())
    fireEvent.click(screen.getByRole('button', { name: 'Transfer' }))
    await screen.findByText('Ownership of My workspace transferred.')
    expect(mocks.transferOwnership).toHaveBeenCalledWith('other')
    fireEvent.click(screen.getByRole('button', { name: 'Retry deleting account' }))
    await screen.findByText('Home')
    expect(mocks.rpc).toHaveBeenCalledTimes(2)
    // First attempt saw a shared workspace, so no screenshots were touched then.
    expect(mocks.list).toHaveBeenCalledTimes(1)
    expect(mocks.signOut).toHaveBeenCalledOnce()
  })

  it('switches and remembers the color scheme from the appearance tab', () => {
    localStorage.clear()
    show('appearance')
    const ocean = screen.getByRole('radio', { name: 'Color scheme Ocean' })
    expect(screen.getByRole('radio', { name: 'Color scheme Violet' })).toBeChecked()
    fireEvent.click(ocean)
    expect(ocean).toBeChecked()
    expect(document.documentElement.dataset.scheme).toBe('ocean')
    expect(localStorage.getItem('squash:scheme')).toBe('ocean')
    fireEvent.click(screen.getByRole('radio', { name: 'Color scheme Violet' }))
    expect(document.documentElement.hasAttribute('data-scheme')).toBe(false)
  })
})
