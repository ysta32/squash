import { Button, Field, Section, inputClass } from '../ui'
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
  if (transferred)
    return (
      <p role="status" className="text-sm text-success">
        Ownership of {workspace.name} transferred.
      </p>
    )
  if (loading)
    return (
      <p role="status" className="text-sm text-muted">
        Loading members of {workspace.name}…
      </p>
    )
  if (notFound)
    return (
      <p role="alert" className="text-sm text-danger">
        Could not load {workspace.name}. Close and reopen this dialog to retry.
      </p>
    )
  if (role !== 'owner' || candidates.length === 0) return null
  return (
    <div className="space-y-3 rounded-lg border border-border bg-bg p-3">
      <Field label={`New owner for ${workspace.name}`}>
        {({ id, describedBy }) => (
          <select
            id={id}
            aria-describedby={describedBy}
            value={selected}
            disabled={busy}
            onChange={(event) => setSelected(event.target.value)}
            className={inputClass}
          >
            <option value="">Choose a member</option>
            {candidates.map((member) => (
              <option key={member.user_id} value={member.user_id}>
                {member.profile.display_name}
              </option>
            ))}
          </select>
        )}
      </Field>
      <Button
        type="button"
        size="sm"
        disabled={busy || !candidates.some((member) => member.user_id === selected)}
        onClick={() =>
          void onTransfer(async () => {
            await transferOwnership(selected)
            setTransferred(true)
          })
        }
      >
        Transfer
      </Button>
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
      <Section
        title="Account"
        description="Manage your sign-in session."
        footer={
          <>
            {error && !open && (
              <p role="alert" className="mr-auto text-sm text-danger">
                {error}
              </p>
            )}
            <Button size="sm" disabled={busy} onClick={() => void run(finishSignOut)}>
              Sign out
            </Button>
          </>
        }
      >
        {user?.email && (
          <div className="space-y-1">
            <p className="text-sm font-medium text-fg">Email</p>
            <p className="text-sm break-all text-muted">{user.email}</p>
          </div>
        )}
      </Section>
      <Section
        title="Delete account"
        tone="danger"
        description="Permanently delete your account and workspaces you own alone. This cannot be undone."
        footer={
          <Button
            size="sm"
            variant="danger"
            disabled={busy}
            onClick={() => {
              setError(null)
              setOpen(true)
            }}
          >
            Delete account
          </Button>
        }
      />
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
          className="m-auto max-h-[85vh] w-[calc(100%-2rem)] max-w-md space-y-4 overflow-y-auto rounded-xl border border-border bg-bg-elevated p-5 text-fg shadow-elevated backdrop:bg-black/40 backdrop:backdrop-blur-[2px]"
        >
          <h3 id="delete-account-title" className="text-base font-semibold">
            Delete account permanently?
          </h3>
          <p className="text-sm text-muted">
            This deletes your account and workspaces where you are the only member. This cannot be
            undone. Shared workspaces must have ownership transferred first.
          </p>
          {needsTransfer && (
            <div className="space-y-3">
              <p role="status" className="text-sm">
                Transfer ownership of each shared workspace below, then retry deleting your account.
              </p>
              {loading && (
                <p role="status" className="text-sm text-muted">
                  Loading workspaces…
                </p>
              )}
              {workspaceError && (
                <div className="space-y-2">
                  <p role="alert" className="text-sm text-danger">
                    {workspaceError}
                  </p>
                  <Button type="button" disabled={busy} onClick={() => void run(refresh)}>
                    Reload workspaces
                  </Button>
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
            <p role="alert" className="text-sm text-danger">
              {error}
            </p>
          )}
          <div className="flex justify-end gap-2 pt-1">
            <Button autoFocus type="button" disabled={busy} onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button disabled={busy} onClick={() => void deleteAccount()} variant="danger">
              {busy
                ? 'Working…'
                : deleted
                  ? 'Finish signing out'
                  : needsTransfer
                    ? 'Retry deleting account'
                    : 'Delete account'}
            </Button>
          </div>
        </dialog>
      )}
    </section>
  )
}
