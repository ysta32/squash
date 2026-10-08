import { DialogHeader } from '../DialogHeader'
import { nativeDialogClass } from '../dialogStyles'
import { showModal } from '../showModal'
import { Button, Field, Input } from '../ui'
import { cn } from '../../lib/utils'
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Check, Copy, UserPlus } from 'lucide-react'
import { InviteDialog } from '../InviteDialog'
import { Avatar } from '../Avatar'
import { DeletionLog } from './DeletionLog'
import { LAST_WORKSPACE_KEY, inviteUrl, useWorkspace } from '../../hooks/useWorkspaces'
import { removeScreenshots } from '../../lib/storageCleanup'
import {
  LedgerGroup,
  LedgerRow,
  LedgerSkeleton,
  SaveError,
  SaveIndicator,
  SettingsPanel,
  TOUCH,
  dangerFillClass,
  dangerGhostClass,
} from './Ledger'
import { useAutosave } from './useAutosave'

export type WorkspaceSection = 'workspace' | 'members' | 'deleted' | 'danger'

/** One workspace settings section: general (name, invite link), members, recently deleted, or
 * the owner's delete-workspace block for the danger zone. */
export function WorkspaceSettings({
  workspaceId,
  section,
}: {
  workspaceId: string
  section: WorkspaceSection
}) {
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
  const [copied, setCopied] = useState(false)
  const [inviteOpen, setInviteOpen] = useState(false)
  /** Which group the last status or error belongs to, so it shows next to its control. */
  const [scope, setScope] = useState<'invite' | 'other'>('other')
  const nameSave = useAutosave(
    `workspace:${workspaceId}:name`,
    workspace?.name ?? '',
    'Could not rename the workspace.',
  )
  // Set by Escape: the draft was thrown away, so a failed rename rolls the field back too.
  const reverted = useRef(false)

  useEffect(() => {
    if (!copied) return
    const timer = window.setTimeout(() => setCopied(false), 2000)
    return () => window.clearTimeout(timer)
  }, [copied])

  async function run(
    action: () => Promise<void>,
    success: string,
    target: 'invite' | 'other' = 'other',
  ) {
    if (busy || !owner) return
    setScope(target)
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

  async function copyInvite(code: string) {
    setScope('invite')
    setMessage(null)
    setError(null)
    try {
      await navigator.clipboard.writeText(inviteUrl(code))
      setCopied(true)
    } catch {
      setError('Could not copy the invite link. Copy the code instead.')
    }
  }

  if (loading)
    return section === 'danger' ? (
      <p role="status" className="py-5 text-sm text-ink-3">
        Loading workspace…
      </p>
    ) : (
      <LedgerSkeleton label="Loading workspace…" />
    )
  if (notFound || !workspace)
    return (
      <p role="alert" className="text-sm text-danger">
        Workspace unavailable.
      </p>
    )

  const feedback =
    error && !confirmDelete ? (
      <p role="alert" className="text-danger">
        {error}
      </p>
    ) : message ? (
      <p role="status" className="text-ink-2">
        {message}
      </p>
    ) : null

  if (section === 'danger') {
    if (!owner) return null
    return (
      <>
        <LedgerRow
          label={`Delete ${workspace.name}`}
          description="Deletes this workspace, its bugs and screenshots for every member. This cannot be undone."
        >
          <Button
            disabled={busy}
            variant="danger"
            className={TOUCH}
            onClick={() => {
              setTypedName('')
              setError(null)
              setConfirmDelete(true)
            }}
          >
            Delete workspace
          </Button>
        </LedgerRow>
        {feedback && <div className="pt-3 text-sm">{feedback}</div>}
        {confirmDelete && (
          <dialog
            ref={showModal}
            onCancel={(event) => {
              event.preventDefault()
              if (!busy) setConfirmDelete(false)
            }}
            aria-labelledby="delete-workspace-title"
            className={nativeDialogClass}
          >
            <form
              onSubmit={(event) => {
                event.preventDefault()
                void destroy()
              }}
              className="space-y-5"
            >
              <DialogHeader
                eyebrow="Danger zone · workspace"
                title={`Delete ${workspace.name}?`}
                titleId="delete-workspace-title"
                closeDisabled={busy}
                onClose={() => setConfirmDelete(false)}
              >
                <p className="mt-2 text-sm text-ink-2">
                  Every bug, comment and screenshot in this workspace is removed for all members.
                  This cannot be undone.
                </p>
              </DialogHeader>
              <Field label={`Type ${workspace.name} to confirm`}>
                {({ id, describedBy }) => (
                  <Input
                    id={id}
                    aria-describedby={describedBy}
                    autoFocus
                    autoComplete="off"
                    spellCheck={false}
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
              <div className="flex justify-end gap-2">
                <Button type="button" disabled={busy} onClick={() => setConfirmDelete(false)}>
                  Cancel
                </Button>
                <button
                  disabled={busy || typedName !== workspace.name}
                  type="submit"
                  className={dangerFillClass}
                >
                  {busy ? 'Deleting…' : 'Delete workspace'}
                </button>
              </div>
            </form>
          </dialog>
        )}
      </>
    )
  }

  if (section === 'deleted') return <DeletionLog workspaceId={workspaceId} members={members} />

  if (section === 'members') {
    const count = members.length
    return (
      <SettingsPanel
        id="members"
        title="Members"
        description={
          owner
            ? 'Everyone with access to this workspace. Removed members lose access right away.'
            : 'Everyone with access to this workspace.'
        }
      >
        <LedgerGroup
          title="People"
          meta={<span className="nums">{count}</span>}
          action={
            <Button
              variant="secondary"
              size="sm"
              className={cn(TOUCH, 'pointer-coarse:min-h-[3.1429rem]')}
              onClick={() => setInviteOpen(true)}
            >
              <UserPlus className="size-3.5" strokeWidth={1.5} absoluteStrokeWidth aria-hidden />
              Invite
            </Button>
          }
        >
          <ul>
            {members.map((member) => (
              <li
                key={member.user_id}
                className="flex min-h-14 items-center gap-3 border-b border-line py-3 max-sm:min-h-[4.5714rem]"
              >
                <Avatar profile={member.profile} />
                <span className="min-w-0 flex-1 text-base font-medium break-words text-ink">
                  {member.profile.display_name}
                </span>
                <span className="specimen-label text-ink-3">{member.role}</span>
                {owner && member.role !== 'owner' && member.user_id !== workspace.owner_id && (
                  <button
                    type="button"
                    disabled={busy}
                    className={dangerGhostClass}
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
          {feedback && <div className="pt-4 text-sm">{feedback}</div>}
        </LedgerGroup>
        <InviteDialog
          workspace={workspace}
          open={inviteOpen}
          onClose={() => setInviteOpen(false)}
          canRegenerate={owner}
          onRegenerate={regenerateInviteCode}
        />
      </SettingsPanel>
    )
  }

  const code = inviteCode ?? workspace.invite_code
  const currentName = name ?? workspace.name
  const nameError = nameSave.state.status === 'error'

  function commitName() {
    if (!owner || !workspace) return
    const next = currentName.trim()
    if (next === nameSave.pending()) {
      if (currentName !== next) setName(next)
      nameSave.clearError()
      return
    }
    if (!next) return nameSave.fail('Workspace name cannot be empty.')
    setName(next)
    reverted.current = false
    void nameSave.commit(next, rename, {
      onFail: (rollbackTo) => {
        if (reverted.current) setName(rollbackTo as string)
      },
    })
  }

  return (
    <SettingsPanel
      id="workspace"
      title="Workspace"
      description={
        owner
          ? 'The name your team sees, and the link that lets teammates in.'
          : 'Only the owner can change workspace settings'
      }
    >
      {owner ? (
        <form
          onSubmit={(event) => {
            event.preventDefault()
            commitName()
          }}
        >
          <LedgerGroup>
            <LedgerRow
              label="Workspace name"
              htmlFor="workspace-name"
              description="Shown in the switcher and on invites. Saves when you leave the field."
              status={<SaveIndicator state={nameSave.state} />}
            >
              <div className="flex w-full flex-col gap-1.5 sm:w-64">
                <Input
                  id="workspace-name"
                  required
                  maxLength={60}
                  enterKeyHint="done"
                  value={currentName}
                  aria-invalid={nameError ? true : undefined}
                  aria-describedby={nameError ? 'workspace-name-error' : undefined}
                  className={TOUCH}
                  onChange={(event) => {
                    reverted.current = false
                    setName(event.target.value)
                  }}
                  onBlur={commitName}
                  onKeyDown={(event) => {
                    if (event.key !== 'Escape') return
                    event.preventDefault()
                    // Back to the name saved or being saved; that save keeps reporting.
                    setName(nameSave.pending())
                    reverted.current = true
                    nameSave.clearError()
                  }}
                />
                <SaveError id="workspace-name-error" state={nameSave.state} />
              </div>
            </LedgerRow>
          </LedgerGroup>
        </form>
      ) : (
        <LedgerGroup>
          <LedgerRow label="Workspace name" description="Ask the owner to rename it.">
            <span className="text-base text-ink">{workspace.name}</span>
          </LedgerRow>
        </LedgerGroup>
      )}
      {owner && (
        <LedgerGroup title="Invite link">
          <LedgerRow
            label="Share link"
            description="Anyone with the link can join. Regenerating turns off every link already shared."
          >
            <code className="flex h-9 items-center rounded-md border border-line bg-surface-3 px-3 font-mono text-sm tracking-widest text-ink nums max-sm:h-[3.1429rem]">
              {code}
            </code>
            <Button disabled={busy} className={TOUCH} onClick={() => void copyInvite(code)}>
              {copied ? (
                <Check className="size-4" strokeWidth={1.5} absoluteStrokeWidth aria-hidden />
              ) : (
                <Copy className="size-4" strokeWidth={1.5} absoluteStrokeWidth aria-hidden />
              )}
              {copied ? 'Copied' : 'Copy link'}
            </Button>
            <Button
              variant="secondary"
              disabled={busy}
              className={TOUCH}
              onClick={() => {
                if (
                  window.confirm(
                    'Regenerate the invite link? Every link already shared will stop working.',
                  )
                )
                  void run(
                    async () => {
                      setInviteCode(await regenerateInviteCode())
                    },
                    'Invite code regenerated.',
                    'invite',
                  )
              }}
            >
              Regenerate
            </Button>
          </LedgerRow>
          {scope === 'invite' && feedback && <div className="pt-4 text-sm">{feedback}</div>}
        </LedgerGroup>
      )}
    </SettingsPanel>
  )
}
