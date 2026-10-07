import { Badge, Button, Field, Input, Section } from '../ui'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Avatar } from '../Avatar'
import { DeletionLog } from './DeletionLog'
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

  if (loading)
    return (
      <p role="status" className="text-sm text-muted">
        Loading workspace…
      </p>
    )
  if (notFound || !workspace)
    return (
      <p role="alert" className="text-sm text-danger">
        Workspace unavailable.
      </p>
    )

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
                size="sm"
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
          <div className="space-y-1">
            <p className="text-sm font-medium">{workspace.name}</p>
            <p className="text-sm text-muted">Only the owner can change workspace settings</p>
          </div>
        </Section>
      )}
      {owner && (
        <Section
          title="Invite code"
          description="Share this code with teammates to invite them to your workspace."
        >
          <div className="flex flex-wrap items-center gap-2">
            <code className="flex h-9 min-w-0 flex-1 items-center rounded-md border border-border bg-bg-subtle px-3 font-mono text-sm tracking-widest">
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
          </div>
        </Section>
      )}
      <Section title="Members" description="See who has access to this workspace.">
        <ul className="-my-2 divide-y divide-border">
          {members.map((member) => (
            <li key={member.user_id} className="flex min-h-12 items-center gap-3 py-2">
              <Avatar profile={member.profile} />
              <span className="min-w-0 flex-1 text-sm font-medium break-words">
                {member.profile.display_name}
              </span>
              <Badge tone={member.role === 'owner' ? 'accent' : 'neutral'} className="capitalize">
                {member.role}
              </Badge>
              {owner && member.role !== 'owner' && member.user_id !== workspace.owner_id && (
                <Button
                  size="sm"
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
      <DeletionLog workspaceId={workspaceId} members={members} />
      {error && !confirmDelete && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
      {message && (
        <p role="status" className="text-sm text-muted">
          {message}
        </p>
      )}
      {owner && (
        <Section
          title="Delete workspace"
          tone="danger"
          description="Permanently delete this workspace, its bugs, and screenshots for every member. This cannot be undone."
          footer={
            <Button
              size="sm"
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
          }
        />
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
          className="m-auto w-[calc(100%-2rem)] max-w-md animate-in rounded-xl border border-border bg-bg-elevated p-5 text-fg shadow-elevated backdrop:bg-black/40 backdrop:backdrop-blur-[2px]"
        >
          <form
            onSubmit={(event) => {
              event.preventDefault()
              void destroy()
            }}
            className="space-y-4"
          >
            <div className="space-y-1">
              <h3 id="delete-workspace-title" className="text-base font-semibold">
                Delete workspace permanently?
              </h3>
              <p className="text-sm text-muted">
                All bugs and screenshots will be permanently removed. This cannot be undone.
              </p>
            </div>
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
              <p role="alert" className="text-sm text-danger">
                {error}
              </p>
            )}
            <div className="flex justify-end gap-2 pt-1">
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
