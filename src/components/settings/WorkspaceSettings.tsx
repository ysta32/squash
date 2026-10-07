import { Button, Field, Input, Section } from '../ui'
import { useEffect, useState } from 'react'
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
  const [savedName, setSavedName] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const dirty = (name ?? workspace?.name ?? '').trim() !== (savedName ?? workspace?.name ?? '')

  useEffect(() => {
    if (!saved) return
    const timer = window.setTimeout(() => setSaved(false), 2500)
    return () => window.clearTimeout(timer)
  }, [saved])

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
      {owner ? (
        <form
          onSubmit={(event) => {
            event.preventDefault()
            if (dirty && (name ?? workspace.name).trim())
              void run(async () => {
                const nextName = (name ?? workspace.name).trim()
                await rename(nextName)
                setSavedName(nextName)
                setName(nextName)
                setSaved(true)
              }, 'Workspace renamed.')
          }}
          className="space-y-3"
        >
          <Section
            title="Workspace"
            description="Set the name your team sees across Squash."
            footer={
              <Button
                type="submit"
                variant="primary"
                disabled={busy || !dirty || !(name ?? workspace.name).trim()}
              >
                {busy ? 'Saving…' : saved ? 'Saved' : 'Save'}
              </Button>
            }
          >
            <Field label="Workspace name">
              {({ id, describedBy }) => (
                <Input
                  id={id}
                  aria-describedby={describedBy}
                  required
                  disabled={busy}
                  value={name ?? workspace.name}
                  onChange={(event) => {
                    setName(event.target.value)
                    setSaved(false)
                  }}
                />
              )}
            </Field>
          </Section>
        </form>
      ) : (
        <Section title="Workspace" description="View your workspace details.">
          <p>{workspace.name}</p>
          <p className="text-muted">Only the owner can change workspace settings</p>
        </Section>
      )}
      {owner && (
        <Section
          title="Invite code"
          description="Share this code with teammates to invite them to your workspace."
        >
          <code className="block rounded-md bg-bg-subtle p-3">
            {inviteCode ?? workspace.invite_code}
          </code>
          <Button
            disabled={busy}
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
          </Button>
        </Section>
      )}
      <Section title="Members" description="See who has access to this workspace.">
        <ul className="divide-y divide-border">
          {members.map((member) => (
            <li key={member.user_id} className="flex items-center gap-3 py-3">
              <Avatar profile={member.profile} />
              <span className="min-w-0 flex-1 break-words">{member.profile.display_name}</span>
              <span className="text-sm text-muted">{member.role}</span>
              {owner && member.role !== 'owner' && member.user_id !== workspace.owner_id && (
                <Button
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
                </Button>
              )}
            </li>
          ))}
        </ul>
      </Section>
      {error && !confirmDelete && (
        <p role="alert" className="text-danger">
          {error}
        </p>
      )}
      {message && (
        <p role="status" className="text-muted">
          {message}
        </p>
      )}
      {owner && (
        <Section
          title="Delete workspace"
          tone="danger"
          description="Permanently delete this workspace, its bugs, and screenshots for every member. This cannot be undone."
        >
          <Button
            disabled={busy}
            variant="danger"
            onClick={() => {
              setTypedName('')
              setError(null)
              setConfirmDelete(true)
            }}
          >
            Delete workspace
          </Button>
        </Section>
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
          className="m-auto w-[calc(100%-2rem)] max-w-md rounded-xl border border-border bg-bg-elevated p-6 text-fg backdrop:bg-fg/50"
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
            <Field label={`Type ${workspace.name} to confirm`}>
              {({ id, describedBy }) => (
                <Input
                  id={id}
                  aria-describedby={describedBy}
                  autoFocus
                  disabled={busy}
                  value={typedName}
                  onChange={(event) => setTypedName(event.target.value)}
                />
              )}
            </Field>
            {error && (
              <p role="alert" className="text-danger">
                {error}
              </p>
            )}
            <div className="flex justify-end gap-3">
              <Button type="button" disabled={busy} onClick={() => setConfirmDelete(false)}>
                Cancel
              </Button>
              <Button
                disabled={busy || typedName !== workspace.name}
                type="submit"
                variant="danger"
              >
                {busy ? 'Deleting…' : 'Delete workspace'}
              </Button>
            </div>
          </form>
        </dialog>
      )}
    </section>
  )
}
