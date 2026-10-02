import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../lib/auth'
import { supabase } from '../../lib/supabase'
import { removeScreenshots } from '../../lib/storageCleanup'
import { useWorkspace, useWorkspaces } from '../../hooks/useWorkspaces'
import type { Workspace } from '../../lib/types'

function OwnershipTransfer({
  workspace,
  busy,
  onTransfer,
}: {
  workspace: Workspace
  busy: boolean
  onTransfer: (action: () => Promise<void>) => Promise<void>
}) {
  const { user } = useAuth()
  const { members, loading, notFound, role, transferOwnership } = useWorkspace(workspace.id)
  const [selected, setSelected] = useState('')
  const [transferred, setTransferred] = useState(false)
  const candidates = members.filter((member) => member.user_id !== user?.id)
  if (transferred) return <p role="status">Ownership of {workspace.name} transferred.</p>
  if (loading) return <p role="status">Loading members of {workspace.name}…</p>
  if (notFound)
    return (
      <p role="alert">Could not load {workspace.name}. Close and reopen this dialog to retry.</p>
    )
  if (role !== 'owner' || candidates.length === 0) return null
  return (
    <div className="space-y-2 rounded-md border border-border p-3">
      <label className="block space-y-2">
        <span>New owner for {workspace.name}</span>
        <select
          value={selected}
          disabled={busy}
          onChange={(event) => setSelected(event.target.value)}
          className="t block w-full rounded-md border border-border bg-bg px-3 py-2 focus:outline-accent"
        >
          <option value="">Choose a member</option>
          {candidates.map((member) => (
            <option key={member.user_id} value={member.user_id}>
              {member.profile.display_name}
            </option>
          ))}
        </select>
      </label>
      <button
        type="button"
        disabled={busy || !candidates.some((member) => member.user_id === selected)}
        className="t rounded-md border border-border px-3 py-2 hover:bg-bg-subtle disabled:opacity-50"
        onClick={() =>
          void onTransfer(async () => {
            await transferOwnership(selected)
            setTransferred(true)
          })
        }
      >
        Transfer
      </button>
    </div>
  )
}

export function AccountSettings() {
  const { user, signOut } = useAuth()
  const { workspaces, loading, error: workspaceError, refresh } = useWorkspaces()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [needsTransfer, setNeedsTransfer] = useState(false)
  const [deleted, setDeleted] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const button =
    't rounded-md border border-border px-3 py-2 hover:bg-bg-subtle disabled:opacity-50'

  async function run(action: () => Promise<void>) {
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      await action()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not update your account.')
    } finally {
      setBusy(false)
    }
  }

  async function finishSignOut() {
    await signOut()
    navigate('/', { replace: true })
  }

  // delete_account deletes owned workspaces only when every one of them has no
  // other members; otherwise it fails with transfer_ownership_required. Returns
  // the owned workspace ids when that precondition holds, or null when it does
  // not (so no screenshots are removed for an account that will survive).
  async function soloOwnedWorkspaceIds(userId: string): Promise<string[] | null> {
    const { data: owned, error: ownedError } = await supabase
      .from('workspaces')
      .select('id')
      .eq('owner_id', userId)
    if (ownedError) throw new Error(ownedError.message)
    const ids = owned.map((workspace) => workspace.id)
    if (ids.length === 0) return ids
    const { data: memberRows, error: membersError } = await supabase
      .from('workspace_members')
      .select('workspace_id, user_id')
      .in('workspace_id', ids)
    if (membersError) throw new Error(membersError.message)
    const shared = memberRows.some((member) => member.user_id !== userId)
    return shared ? null : ids
  }

  async function deleteAccount() {
    await run(async () => {
      if (!deleted) {
        if (!user) throw new Error('You are signed out.')
        const soloOwned = await soloOwnedWorkspaceIds(user.id)
        for (const workspaceId of soloOwned ?? []) await removeScreenshots(workspaceId)
        const { error: deleteError } = await supabase.rpc('delete_account')
        if (deleteError) {
          if (deleteError.message.includes('transfer_ownership_required')) {
            setNeedsTransfer(true)
            await refresh()
            return
          }
          throw new Error(deleteError.message)
        }
        setDeleted(true)
      }
      await finishSignOut()
    })
  }

  return (
    <section className="space-y-6">
      <h2 className="text-lg font-medium">Account</h2>
      <button className={button} disabled={busy} onClick={() => void run(finishSignOut)}>
        Sign out
      </button>
      {error && !open && (
        <p role="alert" className="text-red-500">
          {error}
        </p>
      )}
      <div className="space-y-3 border-t border-border pt-6">
        <h3 className="font-medium text-red-500">Danger zone</h3>
        <p className="text-sm text-muted">
          Permanently delete your account and workspaces you own alone.
        </p>
        <button
          className={`${button} text-red-500`}
          disabled={busy}
          onClick={() => {
            setError(null)
            setOpen(true)
          }}
        >
          Delete account
        </button>
      </div>
      {open && (
        <dialog
          ref={(node) => {
            if (node && !node.open) node.showModal()
          }}
          onCancel={(event) => {
            event.preventDefault()
            if (!busy) setOpen(false)
          }}
          aria-labelledby="delete-account-title"
          className="m-auto max-h-[85vh] w-[calc(100%-2rem)] max-w-md space-y-4 overflow-y-auto rounded-lg border border-border bg-bg-elevated p-6 text-fg backdrop:bg-black/50"
        >
          <h3 id="delete-account-title" className="text-lg font-medium">
            Delete account permanently?
          </h3>
          <p>
            This deletes your account and workspaces where you are the only member. This cannot be
            undone. Shared workspaces must have ownership transferred first.
          </p>
          {needsTransfer && (
            <div className="space-y-3">
              <p role="status">
                Transfer ownership of each shared workspace below, then retry deleting your account.
              </p>
              {loading && <p role="status">Loading workspaces…</p>}
              {workspaceError && (
                <div>
                  <p role="alert" className="text-red-500">
                    {workspaceError}
                  </p>
                  <button
                    type="button"
                    className={button}
                    disabled={busy}
                    onClick={() => void run(refresh)}
                  >
                    Reload workspaces
                  </button>
                </div>
              )}
              {workspaces
                .filter((workspace) => workspace.owner_id === user?.id)
                .map((workspace) => (
                  <OwnershipTransfer
                    key={workspace.id}
                    workspace={workspace}
                    busy={busy}
                    onTransfer={run}
                  />
                ))}
            </div>
          )}
          {error && (
            <p role="alert" className="text-red-500">
              {error}
            </p>
          )}
          <div className="flex justify-end gap-3">
            <button
              autoFocus
              type="button"
              disabled={busy}
              className={button}
              onClick={() => setOpen(false)}
            >
              Cancel
            </button>
            <button
              disabled={busy}
              onClick={() => void deleteAccount()}
              className="t rounded-md bg-red-600 px-3 py-2 text-white hover:bg-red-700 disabled:opacity-50"
            >
              {busy
                ? 'Working…'
                : deleted
                  ? 'Finish signing out'
                  : needsTransfer
                    ? 'Retry deleting account'
                    : 'Delete account'}
            </button>
          </div>
        </dialog>
      )}
    </section>
  )
}
