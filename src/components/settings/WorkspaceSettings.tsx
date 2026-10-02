import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Avatar } from '../Avatar'
import { LAST_WORKSPACE_KEY, useWorkspace } from '../../hooks/useWorkspaces'
import { removeScreenshots } from '../../lib/storageCleanup'

export function WorkspaceSettings({ workspaceId }: { workspaceId: string }) {
  const {
    workspace,
    members,
    role,
    loading,
    notFound,
    rename,
    regenerateInviteCode,
    removeMember,
    deleteWorkspace,
  } = useWorkspace(workspaceId)
  const navigate = useNavigate()
  const [name, setName] = useState<string | null>(null)
  const [inviteCode, setInviteCode] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [typedName, setTypedName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const owner = role === 'owner'
  const button =
    't rounded-md border border-border px-3 py-2 hover:bg-bg-subtle disabled:opacity-50'

  async function run(action: () => Promise<void>, success: string) {
    if (busy || !owner) return
    setBusy(true)
    setError(null)
    setMessage(null)
    try {
      await action()
      setMessage(success)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not update workspace.')
    } finally {
      setBusy(false)
    }
  }

  async function destroy() {
    if (!workspace || typedName !== workspace.name) return
    await run(async () => {
      await removeScreenshots(workspaceId)
      await deleteWorkspace()
      try {
        localStorage.removeItem(LAST_WORKSPACE_KEY)
      } catch {
        /* Storage may be unavailable. */
      }
      navigate('/app', { replace: true })
    }, 'Workspace deleted.')
  }

  if (loading) return <p role="status">Loading workspace…</p>
  if (notFound || !workspace) return <p role="alert">Workspace unavailable.</p>

  return (
    <section className="space-y-6">
      <h2 className="text-lg font-medium">Workspace</h2>
      {owner ? (
        <form
          onSubmit={(event) => {
            event.preventDefault()
            if ((name ?? workspace.name).trim())
              void run(() => rename(name ?? workspace.name), 'Workspace renamed.')
          }}
          className="space-y-3"
        >
          <label className="block space-y-2">
            <span>Workspace name</span>
            <input
              required
              disabled={busy}
              value={name ?? workspace.name}
              onChange={(event) => setName(event.target.value)}
              className="t block w-full rounded-md border border-border bg-bg px-3 py-2 focus:outline-accent"
            />
          </label>
          <button disabled={busy || !(name ?? workspace.name).trim()} className={button}>
            Save name
          </button>
        </form>
      ) : (
        <div className="space-y-2">
          <p>{workspace.name}</p>
          <p className="text-muted">Only the owner can change workspace settings</p>
        </div>
      )}
      {owner && (
        <div className="space-y-3">
          <h3 className="font-medium">Invite code</h3>
          <code className="block rounded-md bg-bg-subtle p-3">
            {inviteCode ?? workspace.invite_code}
          </code>
          <button
            disabled={busy}
            className={button}
            onClick={() => {
              if (
                window.confirm(
                  'Regenerate invite code? The previous invite link will stop working.',
                )
              )
                void run(async () => {
                  setInviteCode(await regenerateInviteCode())
                }, 'Invite code regenerated.')
            }}
          >
            Regenerate
          </button>
        </div>
      )}
      <div>
        <h3 className="mb-3 font-medium">Members</h3>
        <ul className="divide-y divide-border">
          {members.map((member) => (
            <li key={member.user_id} className="flex items-center gap-3 py-3">
              <Avatar profile={member.profile} />
              <span className="min-w-0 flex-1 break-words">{member.profile.display_name}</span>
              <span className="text-sm text-muted">{member.role}</span>
              {owner && member.role !== 'owner' && member.user_id !== workspace.owner_id && (
                <button
                  className={button}
                  disabled={busy}
                  aria-label={`Remove ${member.profile.display_name}`}
                  onClick={() => {
                    if (
                      window.confirm(`Remove ${member.profile.display_name} from this workspace?`)
                    )
                      void run(() => removeMember(member.user_id), 'Member removed.')
                  }}
                >
                  Remove
                </button>
              )}
            </li>
          ))}
        </ul>
      </div>
      {error && !confirmDelete && (
        <p role="alert" className="text-red-500">
          {error}
        </p>
      )}
      {message && (
        <p role="status" className="text-muted">
          {message}
        </p>
      )}
      {owner && (
        <div className="space-y-3 border-t border-border pt-6">
          <h3 className="font-medium text-red-500">Danger zone</h3>
          <p className="text-sm text-muted">
            Permanently delete this workspace, its bugs, and screenshots.
          </p>
          <button
            disabled={busy}
            className={`${button} text-red-500`}
            onClick={() => {
              setTypedName('')
              setError(null)
              setConfirmDelete(true)
            }}
          >
            Delete workspace
          </button>
        </div>
      )}
      {owner && confirmDelete && (
        <dialog
          ref={(node) => {
            if (node && !node.open) node.showModal()
          }}
          onCancel={(event) => {
            event.preventDefault()
            if (!busy) setConfirmDelete(false)
          }}
          aria-labelledby="delete-workspace-title"
          className="m-auto w-[calc(100%-2rem)] max-w-md rounded-lg border border-border bg-bg-elevated p-6 text-fg backdrop:bg-black/50"
        >
          <form
            onSubmit={(event) => {
              event.preventDefault()
              void destroy()
            }}
            className="space-y-4"
          >
            <h3 id="delete-workspace-title" className="text-lg font-medium">
              Delete workspace permanently?
            </h3>
            <p>All bugs and screenshots will be permanently removed. This cannot be undone.</p>
            <label className="block space-y-2">
              <span>Type {workspace.name} to confirm</span>
              <input
                autoFocus
                disabled={busy}
                value={typedName}
                onChange={(event) => setTypedName(event.target.value)}
                className="t block w-full rounded-md border border-border bg-bg px-3 py-2 focus:outline-accent"
              />
            </label>
            {error && (
              <p role="alert" className="text-red-500">
                {error}
              </p>
            )}
            <div className="flex justify-end gap-3">
              <button
                type="button"
                disabled={busy}
                className={button}
                onClick={() => setConfirmDelete(false)}
              >
                Cancel
              </button>
              <button
                disabled={busy || typedName !== workspace.name}
                className="t rounded-md bg-red-600 px-3 py-2 text-white hover:bg-red-700 disabled:opacity-50"
              >
                {busy ? 'Deleting…' : 'Delete workspace'}
              </button>
            </div>
          </form>
        </dialog>
      )}
    </section>
  )
}
