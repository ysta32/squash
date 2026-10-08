import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Check, Copy } from 'lucide-react'
import { AuthLayout, AuthPanel } from '../components/AuthLayout'
import { inviteUrl, setLastWorkspace, useWorkspaces } from '../hooks/useWorkspaces'
import { Button, Field, Input, Kbd, LogoMark } from '../components/ui'
import { INVITE_CODE, INVITE_LENGTH, parseInviteInput } from '../lib/inviteCode'
import type { Workspace } from '../lib/types'
import { AVATAR_PALETTE } from '../lib/avatarColor'
import { cn, isMac } from '../lib/utils'

const STEPS = ['Name it', 'Invite', 'First bug'] as const
const ICON = { strokeWidth: 1.5, absoluteStrokeWidth: true, className: 'size-4' } as const

/** `01 Name it / 02 Invite / 03 First bug`: every step named, the current one in ink. */
function Steps({ current }: { current: number }) {
  return (
    <ol aria-label="Setup steps" className="flex flex-wrap items-center gap-x-2 gap-y-1">
      {STEPS.map((label, index) => (
        <li
          key={label}
          aria-current={index === current ? 'step' : undefined}
          className="flex items-center gap-2"
        >
          {index > 0 && (
            <span aria-hidden="true" className="text-line-2">
              /
            </span>
          )}
          <span className={cn('nums', index === current ? 'text-ink' : 'text-ink-3')}>
            <span className={index < current ? 'text-accent' : undefined}>
              {String(index + 1).padStart(2, '0')}
            </span>
            <span className="ml-1.5">{label}</span>
          </span>
        </li>
      ))}
    </ol>
  )
}

/** Made-up teammates who "arrive" in the invite preview: initials and an avatar ink each. */
const TEAMMATES = [
  { initials: 'JE', ink: AVATAR_PALETTE[0] },
  { initials: 'PR', ink: AVATAR_PALETTE[5] },
  { initials: 'SK', ink: AVATAR_PALETTE[2] },
] as const

/** A staggered entrance (transform and opacity only; reduced motion turns it into a short fade). */
const ARRIVE = 'animate-in [animation-fill-mode:backwards]'
const delay = (ms: number) => ({ animationDelay: `${ms}ms` })

/**
 * The desktop panel during setup: the workspace being made, as it will look the first time it
 * opens. It follows the step: the name as you type it, then teammates arriving in the header once
 * there is an invite link, then the capture bar in focus and No. 001 stamped into the ledger.
 */
function WorkspacePreview({ name, step = 0 }: { name: string; step?: 0 | 1 | 2 }) {
  const shown = name.trim()
  const filing = step === 2
  return (
    <AuthPanel
      label="Preview of your new workspace"
      eyebrow="Your workspace"
      title="Every bug gets a number, a screenshot and a place in the ledger."
    >
      <div
        aria-hidden="true"
        className="overflow-hidden rounded-xl border border-line bg-surface-2 shadow-elev-3"
      >
        <div className="flex h-12 items-center gap-2 border-b border-line px-5 text-sm">
          <LogoMark size={18} />
          <span className="text-line-2">/</span>
          <span className={cn('truncate font-medium', shown ? 'text-ink' : 'text-ink-3')}>
            {shown || 'Your workspace'}
          </span>
          {step >= 1 && (
            <span className="ml-auto flex shrink-0 items-center gap-2.5">
              {step === 1 && (
                <span className={cn(ARRIVE, 'specimen-label text-ink-3')}>Joining</span>
              )}
              <span className="flex -space-x-0.5">
                {TEAMMATES.map(({ initials, ink }, index) => (
                  <span
                    key={initials}
                    style={{
                      ...delay(60 + index * 90),
                      backgroundColor: ink.value,
                      ['--ink-dark' as string]: ink.dark,
                    }}
                    className={cn(
                      ARRIVE,
                      'flex size-7 items-center justify-center rounded-full font-mono text-[0.7143rem] font-medium text-white ring-2 ring-surface-2 dark:bg-(--ink-dark)!',
                    )}
                  >
                    {initials}
                  </span>
                ))}
              </span>
            </span>
          )}
        </div>
        <div className="px-5 pt-5">
          <div
            className={cn(
              't flex h-11 items-center gap-3 rounded-md border bg-surface-1 px-3.5 text-base text-ink-3',
              filing ? 'border-focus ring-3 ring-focus/20' : 'border-line-input',
            )}
          >
            <span className="min-w-0 flex-1 truncate">
              {filing && (
                <span className="mr-0.5 inline-block h-4 w-px translate-y-0.5 bg-ink motion-safe:animate-pulse" />
              )}
              Paste a screenshot or describe a bug
            </span>
            <Kbd>{isMac ? '⌘V' : 'Ctrl+V'}</Kbd>
          </div>
        </div>
        <div className="mt-6 grid grid-cols-[4.5rem_minmax(0,1fr)_6rem] border-y border-line px-5 py-2 specimen-label text-ink-3">
          <span>No.</span>
          <span>Title</span>
          <span>Status</span>
        </div>
        {['001', '002', '003'].map((number, index) => (
          <div
            key={number}
            className="grid h-12 grid-cols-[4.5rem_minmax(0,1fr)_6rem] items-center border-b border-line px-5 last:border-b-0"
          >
            <span
              className={cn('font-mono text-sm nums', index === 0 ? 'text-accent' : 'text-line-2')}
            >
              {number}
            </span>
            {index === 0 && filing ? (
              <span
                style={delay(180)}
                className={cn(ARRIVE, 'truncate text-sm font-medium text-ink')}
              >
                Checkout button hidden behind the cookie banner
              </span>
            ) : index === 0 ? (
              <span className="text-sm text-ink-2">Your first bug lands here.</span>
            ) : (
              <span
                className="h-2 rounded-xs bg-surface-3"
                style={{ width: `${62 - index * 18}%` }}
              />
            )}
            {index === 0 ? (
              <span className="flex items-center gap-1.5 text-sm text-ink-2">
                <span aria-hidden className="size-1.5 rounded-full bg-accent" />
                Open
              </span>
            ) : (
              <span />
            )}
          </div>
        ))}
      </div>
    </AuthPanel>
  )
}

function InviteStep({ workspace, onNext }: { workspace: Workspace; onNext: () => void }) {
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const url = inviteUrl(workspace.invite_code)

  useEffect(() => {
    if (!copied) return
    const timer = window.setTimeout(() => setCopied(false), 2000)
    return () => window.clearTimeout(timer)
  }, [copied])

  return (
    <AuthLayout
      eyebrow={<Steps current={1} />}
      title="Invite a teammate"
      aside={<WorkspacePreview name={workspace.name} step={1} />}
      description={`Anyone with this link can join ${workspace.name}. Bugs are better with two people: one files, one fixes.`}
      footer="You can regenerate the link later in Settings, which turns this one off."
    >
      <div className="space-y-6">
        <div className="flex min-w-0 items-stretch overflow-hidden rounded-md border border-line-input bg-surface-2">
          <code className="flex min-w-0 flex-1 items-center truncate px-3 font-mono text-sm text-ink">
            {url}
          </code>
          <button
            type="button"
            onClick={async () => {
              setError(null)
              try {
                await navigator.clipboard.writeText(url)
                setCopied(true)
              } catch {
                setError('Could not copy. Select the link and copy it manually.')
              }
            }}
            className="t focus-ring-inset flex min-h-11 shrink-0 items-center gap-1.5 border-l border-line px-3 text-sm font-medium text-ink hover:bg-surface-3"
          >
            {copied ? <Check {...ICON} aria-hidden /> : <Copy {...ICON} aria-hidden />}
            {copied ? 'Copied' : 'Copy link'}
          </button>
        </div>
        {error && (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        )}
        <div className="flex flex-col gap-3 sm:flex-row-reverse">
          <Button variant="primary" size="lg" className="sm:flex-1" onClick={onNext}>
            Continue
          </Button>
          <Button variant="ghost" size="lg" className="sm:flex-1" onClick={onNext}>
            Skip for now
          </Button>
        </div>
      </div>
    </AuthLayout>
  )
}

function FirstBugStep({ workspace }: { workspace: Workspace }) {
  const navigate = useNavigate()
  return (
    <AuthLayout
      eyebrow={<Steps current={2} />}
      title="File your first bug"
      aside={<WorkspacePreview name={workspace.name} step={2} />}
      description={`${workspace.name} is ready. The capture bar sits at the top of the workspace.`}
    >
      <ol className="mb-8 border-t border-line text-sm text-ink-2">
        <li className="flex items-baseline gap-4 border-b border-line py-3">
          <span className="font-mono text-xs text-ink-3 nums">A</span>
          <span>
            Take a screenshot, then paste it with <Kbd>{isMac ? '⌘V' : 'Ctrl+V'}</Kbd>
          </span>
        </li>
        <li className="flex items-baseline gap-4 border-b border-line py-3">
          <span className="font-mono text-xs text-ink-3 nums">B</span>
          <span>
            Or press <Kbd>N</Kbd> and describe what broke
          </span>
        </li>
        <li className="flex items-baseline gap-4 border-b border-line py-3">
          <span className="font-mono text-xs text-ink-3 nums">C</span>
          <span>
            File it with <Kbd>Enter</Kbd>
          </span>
        </li>
      </ol>
      <Button
        variant="primary"
        size="lg"
        className="w-full"
        onClick={() => navigate(`/app/${workspace.id}`)}
      >
        Open {workspace.name}
      </Button>
    </AuthLayout>
  )
}

export default function Onboarding() {
  const navigate = useNavigate()
  const { createWorkspace, joinWorkspace } = useWorkspaces()
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<{ form: 'create' | 'join'; message: string } | null>(null)
  const [created, setCreated] = useState<Workspace | null>(null)
  const [step, setStep] = useState<1 | 2>(1)

  const onCreate = async (e: FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    setBusy(true)
    setError(null)
    try {
      const ws = await createWorkspace(name)
      setLastWorkspace(ws.id)
      setCreated(ws)
      setStep(1)
    } catch (err) {
      setError({
        form: 'create',
        message: err instanceof Error ? err.message : 'Could not create the workspace.',
      })
    } finally {
      setBusy(false)
    }
  }

  const onJoin = async (e: FormEvent) => {
    e.preventDefault()
    if (!INVITE_CODE.test(code)) return
    setBusy(true)
    setError(null)
    try {
      const ws = await joinWorkspace(code)
      setLastWorkspace(ws.id)
      navigate(`/app/${ws.id}`)
    } catch (err) {
      setError({
        form: 'join',
        message: err instanceof Error ? err.message : 'Could not join that workspace.',
      })
    } finally {
      setBusy(false)
    }
  }

  // Only flag a code once it can no longer become valid by typing more.
  const codeProblem =
    code.length > INVITE_LENGTH || /[^A-HJ-NP-Z2-9]/.test(code)
      ? 'Invite codes are 8 letters and digits, without 0, 1, I or O.'
      : null

  if (created && step === 1) return <InviteStep workspace={created} onNext={() => setStep(2)} />
  if (created) return <FirstBugStep workspace={created} />

  return (
    <AuthLayout
      eyebrow={<Steps current={0} />}
      title="Name your workspace"
      aside={<WorkspacePreview name={name} />}
      description="A workspace is where your team’s bugs live. Use your team or product name."
      footer={
        <form onSubmit={(e) => void onJoin(e)}>
          <Field
            label="Have an invite?"
            hint="Paste the invite link a teammate sent, or its 8-character code."
            error={error?.form === 'join' ? error.message : codeProblem}
          >
            {({ id, describedBy }) => (
              <div className="flex gap-2">
                <Input
                  id={id}
                  value={code}
                  onChange={(e) => {
                    setCode(parseInviteInput(e.target.value))
                    if (error?.form === 'join') setError(null)
                  }}
                  placeholder="Invite link or code"
                  aria-label="Invite code"
                  aria-describedby={describedBy}
                  aria-invalid={codeProblem || error?.form === 'join' ? true : undefined}
                  autoComplete="off"
                  autoCapitalize="characters"
                  spellCheck={false}
                  className={cn(
                    'min-w-0 flex-1 max-sm:min-h-[3.1429rem]',
                    // Mono only once there is a code; the placeholder stays plain sans text-3.
                    code && 'font-mono tracking-widest uppercase',
                  )}
                />
                <Button
                  type="submit"
                  variant="secondary"
                  disabled={busy || !INVITE_CODE.test(code)}
                  className="w-20 max-sm:min-h-[3.1429rem]"
                >
                  Join
                </Button>
              </div>
            )}
          </Field>
        </form>
      }
    >
      <form onSubmit={(e) => void onCreate(e)} className="space-y-4">
        <Field
          label="Workspace name"
          hint="You can rename it later in Settings."
          error={error?.form === 'create' ? error.message : null}
        >
          {({ id, describedBy }) => (
            <Input
              id={id}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Acme web app"
              aria-label="Workspace name"
              aria-describedby={describedBy}
              maxLength={60}
              autoFocus
              className="max-sm:min-h-[3.1429rem]"
            />
          )}
        </Field>
        <Button
          type="submit"
          variant="primary"
          size="lg"
          disabled={busy || !name.trim()}
          className="w-full"
        >
          {busy ? 'Creating…' : 'Create workspace'}
        </Button>
      </form>
    </AuthLayout>
  )
}
