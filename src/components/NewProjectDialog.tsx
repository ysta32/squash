import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Rocket } from 'lucide-react'
import { useFocusTrap } from '../hooks/useFocusTrap'
import { setLastWorkspace } from '../hooks/useWorkspaces'
import { BridgeError, installCommand, projectSlug } from '../lib/claudeExport'
import { BRIEF_MAX, startNewProject } from '../lib/newProject'
import { cn } from '../lib/utils'
import { Button, Field, Input } from './ui'
import { inputClass } from './ui/styles'
import { DialogHeader } from './DialogHeader'
import {
  dialogActionsClass,
  dialogClass,
  dialogMaxHeightClass,
  dialogPositionClass,
  scrimClass,
} from './dialogStyles'

/** Full-width 44px buttons on phones; regular height from 480px unless the pointer is coarse. */
const TOUCH = 'max-[479px]:h-11 max-[479px]:w-full pointer-coarse:h-[3.1429rem]'
const STACK = 'max-[479px]:flex-col-reverse max-[479px]:items-stretch'

interface NewProjectDialogProps {
  open: boolean
  onClose: () => void
}

/**
 * "New project": asks what to build, then has Squash set it all up: a workspace, a local folder
 * (a git repo), a first feature with the brief, and a Claude Code run that builds it, creates the
 * GitHub repo and pushes. Opens the new workspace on that feature to follow along.
 */
export function NewProjectDialog({ open, onClose }: NewProjectDialogProps) {
  const [name, setName] = useState('')
  const [brief, setBrief] = useState('')
  const [parent, setParent] = useState('')
  const [isPublic, setIsPublic] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<{ message: string; install: boolean } | null>(null)
  const dialogRef = useRef<HTMLFormElement>(null)
  const navigate = useNavigate()
  useFocusTrap(dialogRef, open, { initialFocus: 'field' })

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, busy, onClose])

  if (!open) return null

  const slug = projectSlug(name)
  const close = () => {
    if (!busy) onClose()
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      const { workspace, bugNumber } = await startNewProject({
        name,
        brief,
        parent,
        isPublic,
        origin: window.location.origin,
      })
      setLastWorkspace(workspace.id)
      onClose()
      navigate(`/app/${workspace.id}/bug/${bugNumber}`)
    } catch (err) {
      const install =
        err instanceof TypeError ||
        (err instanceof BridgeError && (err.code === 'outdated' || err.code === 'unreachable'))
      const message =
        err instanceof BridgeError && err.code === 'cancelled'
          ? 'No folder chosen, so nothing was created.'
          : err instanceof TypeError
            ? 'The Claude Code helper is not responding.'
            : err instanceof Error
              ? err.message
              : 'Could not start the project.'
      setError({ message, install })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={cn(scrimClass, dialogPositionClass)} onClick={close}>
      <form
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="New project"
        onSubmit={(e) => void submit(e)}
        className={cn(dialogClass, dialogMaxHeightClass, 'max-w-120 overflow-y-auto p-6')}
        onClick={(e) => e.stopPropagation()}
      >
        <DialogHeader
          eyebrow="Claude Code · new project"
          title="Start a new project"
          onClose={close}
          closeDisabled={busy}
        >
          <p className="mt-1 text-sm text-ink-2">
            Squash makes the folder and GitHub repo, and Claude Code builds a first version.
          </p>
        </DialogHeader>

        <Field
          label="Project name"
          className="mt-6"
          hint={slug ? `Folder and repo: ${slug}` : 'Letters and numbers, e.g. Recipe Box'}
        >
          {({ id, describedBy }) => (
            <Input
              id={id}
              aria-describedby={describedBy}
              required
              maxLength={100}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Recipe Box"
              autoComplete="off"
            />
          )}
        </Field>

        <Field
          label="What do you want built?"
          className="mt-4"
          hint="What it is, who it is for, the main things it should do, and any stack you want."
        >
          {({ id, describedBy }) => (
            <textarea
              id={id}
              aria-describedby={describedBy}
              required
              rows={5}
              maxLength={BRIEF_MAX}
              value={brief}
              onChange={(e) => setBrief(e.target.value)}
              placeholder="A website where I can save recipes, tag them and search by ingredient."
              className={cn(inputClass, 'h-auto min-h-28 resize-y py-2 pointer-coarse:h-auto')}
            />
          )}
        </Field>

        <Field
          label="Create it in"
          className="mt-4"
          hint="A folder on this computer. Leave it empty to pick one."
        >
          {({ id, describedBy }) => (
            <Input
              id={id}
              aria-describedby={describedBy}
              value={parent}
              onChange={(e) => setParent(e.target.value)}
              placeholder="~/Projects"
              autoComplete="off"
              spellCheck={false}
              className="font-mono text-sm"
            />
          )}
        </Field>

        <label className="mt-4 flex items-center gap-2 text-sm text-ink">
          <input
            type="checkbox"
            checked={isPublic}
            onChange={(e) => setIsPublic(e.target.checked)}
            className="focus-ring size-4 accent-(--accent)"
          />
          Make the GitHub repo public
        </label>

        {error && (
          <div role="alert" className="mt-4 text-sm text-danger">
            <p>{error.message}</p>
            {error.install && (
              <p className="mt-2 text-ink-2">
                Install or update it by running{' '}
                <code className="font-mono text-xs [overflow-wrap:anywhere] text-ink">
                  {installCommand(window.location.origin)}
                </code>{' '}
                in a terminal.
              </p>
            )}
          </div>
        )}

        <div className={cn(dialogActionsClass, STACK)}>
          <Button type="button" onClick={close} disabled={busy} className={TOUCH}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            disabled={busy || !slug || !brief.trim()}
            className={TOUCH}
          >
            <Rocket size={16} absoluteStrokeWidth strokeWidth={1.5} aria-hidden="true" />
            {busy ? 'Setting up…' : 'Create and build'}
          </Button>
        </div>
      </form>
    </div>
  )
}
