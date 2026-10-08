import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import Settings from './Settings'
import { resetAutosaveLines } from '../components/settings/useAutosave'

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
  inviteUrl: (code: string) => `http://localhost/join/${code}`,
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
// The deletion log has its own tests; keep its fetch out of these flows.
vi.mock('../hooks/useDeletionLog', () => ({
  useDeletionLog: () => ({ deletions: [], loading: false, error: null }),
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
/** Opens the delete-account dialog and types the confirmation phrase. */
function confirmAccountDeletion() {
  fireEvent.click(screen.getByRole('button', { name: 'Delete account' }))
  const dialog = screen.getByRole('dialog')
  fireEvent.change(within(dialog).getByLabelText('Type “delete my account” to confirm'), {
    target: { value: 'delete my account' },
  })
  return dialog
}
function deletionDialog() {
  fireEvent.click(screen.getByRole('button', { name: 'Delete workspace' }))
  return screen.getByRole('dialog')
}

beforeEach(() => {
  vi.resetAllMocks()
  resetAutosaveLines()
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
    cleanup()
    show('members')
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
    show('danger')
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
    show('danger')
    const dialog = deletionDialog()
    fireEvent.change(within(dialog).getByRole('textbox'), { target: { value: 'My workspace' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Delete workspace' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Remove failed')
    expect(mocks.deleteWorkspace).not.toHaveBeenCalled()
    expect(localStorage.getItem('squash:lastWorkspace')).toBe('ws')
  })

  it('shows account deletion errors without signing out', async () => {
    mocks.rpc.mockResolvedValue({ error: { message: 'Account deletion unavailable' } })
    show('danger')
    const dialog = confirmAccountDeletion()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Delete account' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Account deletion unavailable')
    expect(mocks.signOut).not.toHaveBeenCalled()
  })

  it('renders tabs, defaults to profile, and switches panels', () => {
    show()
    const tabs = screen.getByRole('navigation', { name: 'Settings tabs' })
    expect(
      within(tabs)
        .getAllByRole('link')
        .map((link) => link.textContent),
    ).toEqual([
      '01Profile',
      '02Workspace',
      '03Members',
      '04Appearance',
      '05Notifications',
      '06Claude Code',
      '07Recently deleted',
      '08Danger zone',
    ])
    expect(within(tabs).getByRole('link', { name: /Profile/ })).toHaveAttribute(
      'aria-current',
      'page',
    )
    expect(screen.getByLabelText('Display name')).toHaveValue('Ada')
    expect(screen.getByRole('button', { name: 'Sign out' })).toBeInTheDocument()
    fireEvent.click(within(tabs).getByRole('link', { name: /Workspace/ }))
    expect(screen.getByLabelText('Workspace name')).toHaveValue('My workspace')
    expect(screen.queryByRole('heading', { name: 'Recently deleted' })).not.toBeInTheDocument()
    fireEvent.click(within(tabs).getByRole('link', { name: /Members/ }))
    expect(screen.getByText('Grace')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Invite' }))
    expect(screen.getByRole('dialog', { name: 'Invite people' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(screen.queryByRole('dialog', { name: 'Invite people' })).not.toBeInTheDocument()
    fireEvent.click(within(tabs).getByRole('link', { name: /Recently deleted/ }))
    expect(screen.getByRole('heading', { name: 'Recently deleted' })).toBeInTheDocument()
    expect(screen.getByText('Nothing has been deleted.')).toBeInTheDocument()
    fireEvent.click(within(tabs).getByRole('link', { name: /Danger zone/ }))
    expect(screen.getByRole('button', { name: 'Delete workspace' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Delete account' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Back to workspace' })).toHaveAttribute(
      'href',
      '/app/ws',
    )
  })

  it('deletes the account only after the confirmation phrase is typed', () => {
    show('danger')
    fireEvent.click(screen.getByRole('button', { name: 'Delete account' }))
    const dialog = screen.getByRole('dialog')
    const remove = within(dialog).getByRole('button', { name: 'Delete account' })
    const input = within(dialog).getByLabelText('Type “delete my account” to confirm')
    expect(remove).toBeDisabled()
    fireEvent.click(remove)
    fireEvent.change(input, { target: { value: 'delete my' } })
    expect(remove).toBeDisabled()
    fireEvent.change(input, { target: { value: 'Delete my account' } })
    expect(remove).toBeEnabled()
    expect(mocks.rpc).not.toHaveBeenCalled()
  })

  it('opens the danger zone for the retired account tab', () => {
    show('account')
    expect(screen.getByRole('heading', { name: 'Danger zone' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Delete account' })).toBeInTheDocument()
  })

  it('signs out from the profile tab and returns home', async () => {
    show()
    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }))
    await screen.findByText('Home')
    expect(mocks.signOut).toHaveBeenCalledOnce()
  })

  it('shows read-only workspace information to non-owners', () => {
    mocks.role = 'member'
    show('workspace')
    expect(screen.getByText('Only the owner can change workspace settings')).toBeInTheDocument()
    const ownerOnly = /Delete workspace|Remove|Regenerate|Save/
    expect(screen.queryByRole('button', { name: ownerOnly })).not.toBeInTheDocument()
    cleanup()
    show('members')
    expect(screen.getByText('Grace')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: ownerOnly })).not.toBeInTheDocument()
    cleanup()
    show('danger')
    expect(screen.queryByRole('button', { name: ownerOnly })).not.toBeInTheDocument()
  })

  it('requires the exact workspace name before deletion', () => {
    show('danger')
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

  it('autosaves the profile name on blur and a palette color on click, then refreshes', async () => {
    show()
    const name = screen.getByLabelText('Display name')
    fireEvent.change(name, { target: { value: '  Ada Lovelace  ' } })
    fireEvent.blur(name)
    await screen.findByText('Saved')
    expect(mocks.update).toHaveBeenCalledWith({ display_name: 'Ada Lovelace' })
    expect(name).toHaveValue('Ada Lovelace')
    fireEvent.click(screen.getByRole('button', { name: 'Avatar color Moss' }))
    await waitFor(() => expect(mocks.update).toHaveBeenCalledWith({ avatar_color: '#2e772a' }))
    expect(screen.getByRole('button', { name: 'Avatar color Moss' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(mocks.eq).toHaveBeenCalledWith('id', 'self')
    await waitFor(() => expect(mocks.refreshProfile).toHaveBeenCalledTimes(2))
  })

  it('saves the profile name only when it changed, once, and shows Saved briefly', async () => {
    show()
    const name = screen.getByLabelText('Display name')
    fireEvent.blur(name)
    fireEvent.change(name, { target: { value: 'Ada changed' } })
    fireEvent.change(name, { target: { value: 'Ada ' } })
    fireEvent.blur(name)
    expect(mocks.update).not.toHaveBeenCalled()
    expect(name).toHaveValue('Ada')
    fireEvent.change(name, { target: { value: 'Ada changed' } })
    vi.useFakeTimers()
    try {
      // Enter submits; leaving the field afterwards must not save the same name again.
      await act(async () => fireEvent.submit(name.closest('form') as HTMLFormElement))
      await act(async () => fireEvent.blur(name))
      expect(mocks.update).toHaveBeenCalledOnce()
      expect(mocks.update).toHaveBeenCalledWith({ display_name: 'Ada changed' })
      expect(screen.getByText('Saved')).toBeInTheDocument()
      act(() => vi.advanceTimersByTime(2500))
      expect(screen.queryByText('Saved')).not.toBeInTheDocument()
    } finally {
      vi.useRealTimers()
    }
  })

  it('keeps a failed profile save in the field and retries it on the next blur', async () => {
    mocks.eq.mockResolvedValueOnce({ error: { message: 'Update failed' } })
    show()
    const name = screen.getByLabelText('Display name')
    fireEvent.change(name, { target: { value: 'New name' } })
    fireEvent.blur(name)
    expect(await screen.findByRole('alert')).toHaveTextContent('Update failed')
    expect(name).toHaveValue('New name')
    expect(name).toHaveAttribute('aria-invalid', 'true')
    expect(mocks.refreshProfile).not.toHaveBeenCalled()
    fireEvent.blur(name)
    await screen.findByText('Saved')
    expect(mocks.update).toHaveBeenCalledTimes(2)
    expect(mocks.refreshProfile).toHaveBeenCalledOnce()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('keeps saves in order across a tab switch: A, then B, then C after coming back', async () => {
    const pending: Array<(result: { error: null }) => void> = []
    mocks.eq.mockImplementation(() => new Promise((resolve) => pending.push(resolve)))
    show()
    const tabs = () => screen.getByRole('navigation', { name: 'Settings tabs' })
    const type = (value: string) => {
      const field = screen.getByLabelText('Display name')
      fireEvent.change(field, { target: { value } })
      fireEvent.blur(field)
    }
    type('Name A')
    type('Name B')
    await waitFor(() => expect(mocks.update).toHaveBeenCalledTimes(1))
    // Leave the tab while A is in flight and B is queued, then come back and save C.
    fireEvent.click(within(tabs()).getByRole('link', { name: /Workspace/ }))
    expect(screen.queryByLabelText('Display name')).not.toBeInTheDocument()
    fireEvent.click(within(tabs()).getByRole('link', { name: /Profile/ }))
    type('Name C')
    await act(async () => pending.shift()?.({ error: null }))
    await waitFor(() => expect(mocks.update).toHaveBeenCalledTimes(2))
    expect(mocks.update).toHaveBeenLastCalledWith({ display_name: 'Name B' })
    // C waits for B even though it was made by a fresh mount.
    await act(async () => {
      await Promise.resolve()
    })
    expect(mocks.update).toHaveBeenCalledTimes(2)
    await act(async () => pending.shift()?.({ error: null }))
    await waitFor(() => expect(mocks.update).toHaveBeenCalledTimes(3))
    expect(mocks.update).toHaveBeenLastCalledWith({ display_name: 'Name C' })
    await act(async () => pending.shift()?.({ error: null }))
    expect(mocks.update.mock.calls.map(([patch]) => patch)).toEqual([
      { display_name: 'Name A' },
      { display_name: 'Name B' },
      { display_name: 'Name C' },
    ])
  })

  it('still reports a failed save after Escape reverts the draft, and rolls the field back', async () => {
    let finish: (result: { error: { message: string } }) => void = () => {}
    mocks.eq.mockImplementationOnce(() => new Promise((resolve) => (finish = resolve)))
    show()
    const name = screen.getByLabelText('Display name')
    fireEvent.change(name, { target: { value: 'New name' } })
    fireEvent.blur(name)
    await waitFor(() => expect(mocks.update).toHaveBeenCalledOnce())
    fireEvent.change(name, { target: { value: 'Newer draft' } })
    fireEvent.keyDown(name, { key: 'Escape' })
    expect(name).toHaveValue('New name')
    expect(screen.getByText('Saving…')).toBeInTheDocument()
    await act(async () => finish({ error: { message: 'Update failed' } }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Update failed')
    expect(name).toHaveValue('Ada')
    expect(mocks.refreshProfile).not.toHaveBeenCalled()
  })

  it('refuses a blank profile name and reverts the field on Escape', () => {
    show()
    const name = screen.getByLabelText('Display name')
    fireEvent.change(name, { target: { value: '   ' } })
    fireEvent.blur(name)
    expect(screen.getByRole('alert')).toHaveTextContent('Display name cannot be empty.')
    expect(mocks.update).not.toHaveBeenCalled()
    fireEvent.keyDown(name, { key: 'Escape' })
    expect(name).toHaveValue('Ada')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('autosaves the workspace name on blur or Enter, once per change', async () => {
    show('workspace')
    const name = screen.getByLabelText('Workspace name')
    fireEvent.blur(name)
    expect(mocks.rename).not.toHaveBeenCalled()
    fireEvent.change(name, { target: { value: 'Team workspace' } })
    fireEvent.blur(name)
    await screen.findByText('Saved')
    expect(mocks.rename).toHaveBeenCalledWith('Team workspace')
    fireEvent.blur(name)
    expect(mocks.rename).toHaveBeenCalledOnce()
    fireEvent.change(name, { target: { value: 'Another workspace' } })
    fireEvent.submit(name.closest('form') as HTMLFormElement)
    await waitFor(() => expect(mocks.rename).toHaveBeenCalledWith('Another workspace'))
    expect(mocks.rename).toHaveBeenCalledTimes(2)
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
    ).toHaveLength(5)
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
    show('danger')
    const dialog = deletionDialog()
    fireEvent.change(within(dialog).getByRole('textbox'), { target: { value: 'My workspace' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Delete workspace' }))
    await screen.findByText('Workspace picker')
    expect(mocks.deleteWorkspace).toHaveBeenCalledOnce()
    expect(localStorage.getItem('squash:lastWorkspace')).toBeNull()
  })

  it('does not delete the workspace if screenshot cleanup fails', async () => {
    mocks.list.mockResolvedValue({ data: null, error: { message: 'Storage unavailable' } })
    show('danger')
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
    const dialog = confirmAccountDeletion()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Delete account' }))
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
    const dialog = confirmAccountDeletion()
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
    const ocean = screen.getByRole('radio', { name: 'Color scheme Cyanotype' })
    expect(screen.getByRole('radio', { name: 'Color scheme Viridian' })).toBeChecked()
    fireEvent.click(ocean)
    expect(ocean).toBeChecked()
    expect(document.documentElement.dataset.scheme).toBe('ocean')
    expect(localStorage.getItem('squash:scheme')).toBe('ocean')
    fireEvent.click(screen.getByRole('radio', { name: 'Color scheme Viridian' }))
    expect(document.documentElement.hasAttribute('data-scheme')).toBe(false)
  })
})
