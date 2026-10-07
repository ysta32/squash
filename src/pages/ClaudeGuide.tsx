import { useEffect, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Check, Copy, RefreshCw } from 'lucide-react'
import {
  BRIDGE_URL,
  BRIDGE_VERSION,
  PROGRESS_VERSION,
  AUTO_RESOLVE_VERSION,
  installCommand,
  pingBridge,
  type BridgeStatus,
} from '../lib/claudeExport'
import { cn } from '../lib/utils'
import { Badge, Button, Input, Kbd, Logo } from '../components/ui'

const POLL_MS = 2000

/** A terminal command with a copy button. */
export function CommandBlock({ command, label }: { command: string; label: string }) {
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!copied) return
    const t = setTimeout(() => setCopied(false), 2000)
    return () => clearTimeout(t)
  }, [copied])

  const copy = async () => {
    setError(null)
    setCopied(false)
    try {
      await navigator.clipboard.writeText(command)
      setCopied(true)
    } catch {
      setError('Could not copy. Select the command and copy it manually.')
    }
  }

  return (
    <div role="group" aria-label={`${label} block`} className="mt-3">
      <div className="flex gap-2">
        <Input
          readOnly
          value={command}
          aria-label={label}
          onFocus={(e) => e.currentTarget.select()}
          className="min-w-0 flex-1 font-mono text-xs"
        />
        <Button type="button" onClick={() => void copy()} variant="primary">
          {copied ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
          <span aria-live="polite">{copied ? 'Copied' : 'Copy'}</span>
        </Button>
      </div>
      {error && (
        <p role="alert" className="mt-2 text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  )
}

type HelperState =
  { state: 'idle' } | { state: 'checking' } | { state: 'done'; status: BridgeStatus | null }

/**
 * Checks this computer's helper on request (not on load: reaching localhost makes Chrome ask for
 * local network access), then keeps checking so it flips as soon as an install finishes.
 */
function HelperCheck() {
  const [check, setCheck] = useState<HelperState>({ state: 'idle' })
  const watching = check.state !== 'idle'

  useEffect(() => {
    if (!watching) return
    let active = true
    const run = () =>
      void pingBridge().then((status) => active && setCheck({ state: 'done', status }))
    run()
    const timer = setInterval(run, POLL_MS)
    return () => {
      active = false
      clearInterval(timer)
    }
  }, [watching])

  const status = check.state === 'done' ? check.status : null
  const [dot, text] =
    check.state === 'idle'
      ? ['bg-muted', 'Not checked yet.']
      : check.state === 'checking'
        ? ['animate-pulse bg-muted', 'Checking…']
        : status === null
          ? [
              'animate-pulse bg-muted',
              'No helper found on this computer. Install it below; this updates by itself.',
            ]
          : status.version < BRIDGE_VERSION
            ? [
                'bg-warning',
                `An old helper (v${status.version}) is running. Run the command below to update it.`,
              ]
            : status.version < PROGRESS_VERSION
              ? [
                  'bg-warning',
                  `Helper v${status.version} is running. It can send bugs, but run the command below to update it so you can follow Claude’s progress.`,
                ]
              : status.version < AUTO_RESOLVE_VERSION
                ? [
                    'bg-warning',
                    `Helper v${status.version} is running. Run the command below to update it so Claude resolves bugs on its own when it finishes.`,
                  ]
                : [
                    'bg-success',
                    `Helper v${status.version} is installed and up to date. Claude reports its progress and resolves bugs in Squash when it finishes.`,
                  ]

  return (
    <div className="mt-6 rounded-xl border border-border p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-medium">Your helper</p>
        {check.state === 'idle' && (
          <Button type="button" onClick={() => setCheck({ state: 'checking' })} size="sm">
            <RefreshCw size={14} aria-hidden="true" /> Check this computer
          </Button>
        )}
      </div>
      <p role="status" className="mt-2 flex items-start gap-2 text-sm text-muted">
        <span className={cn('mt-1.5 h-2 w-2 shrink-0 rounded-full', dot)} />
        {text}
      </p>
      {check.state === 'idle' && (
        <p className="mt-2 text-xs text-muted">
          Chrome may ask to let this page reach your local network. Allow it: that is how Squash
          talks to the helper.
        </p>
      )}
    </div>
  )
}

function Step({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <li className="flex gap-4">
      <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent/15 text-xs font-semibold text-accent">
        {n}
      </span>
      <div className="min-w-0 flex-1">
        <h3 className="font-medium">{title}</h3>
        <div className="mt-1 space-y-2 text-sm leading-6 text-muted">{children}</div>
      </div>
    </li>
  )
}

const code = 'rounded bg-bg-subtle px-1 py-0.5 font-mono text-xs text-fg'

export default function ClaudeGuide() {
  const origin = window.location.origin
  const command = installCommand(origin)

  return (
    <div className="min-h-screen bg-bg text-fg">
      <header className="border-b border-border">
        <nav aria-label="Main navigation" className="mx-auto flex h-14 max-w-2xl items-center px-6">
          <Link to="/" aria-label="Squash home" className="focus-ring rounded-md">
            <Logo />
          </Link>
        </nav>
      </header>
      <main className="mx-auto max-w-2xl px-6 py-10 text-base leading-7 sm:py-14">
        <Badge tone="accent" className="mb-4 text-xs">
          Claude Code
        </Badge>
        <h1 className="text-3xl font-semibold tracking-tight">Claude Code helper</h1>
        <p className="mt-4 leading-7 text-muted">
          The helper is a small program on your computer that lets Squash open Claude Code on a bug,
          with its screenshots, in your project folder. While Claude works, the helper reports back
          so the bug in Squash shows what Claude is doing: its current step, its plan, and its
          summary when it is done.
        </p>

        <section className="mt-8 rounded-xl border border-border bg-bg-subtle p-5">
          <h2 className="text-lg font-semibold">How it works</h2>
          <p className="mt-2 text-sm leading-7 text-muted">
            Squash sends the bugs you select, their comments, and screenshot links to a local helper
            at <code className={code}>127.0.0.1:4317</code>. It accepts requests from configured
            Squash origins and saves the reports and downloaded screenshots under{' '}
            <code className={code}>.squash/</code> in your chosen project folder.
          </p>
          <p className="mt-3 text-sm leading-7 text-muted">
            The helper launches Claude Code in that folder and reads its local progress and results.
            Claude can read and change project files under your Claude Code permissions; the
            selected folder is a working directory, not a sandbox. Your Claude Code session
            processes the reports, screenshots, and any project content it reads.
          </p>
        </section>

        <HelperCheck />

        <section className="mt-10">
          <h2 className="text-lg font-semibold">Install or update</h2>
          <p className="mt-2 text-sm leading-6 text-muted">
            The same command installs the helper and updates an existing one. If you installed it
            before live progress arrived, run it again.
          </p>
          <ol className="mt-6 space-y-6">
            <Step n={1} title="Check what you need">
              <p>
                A Mac (Linux works too, see below),{' '}
                <a
                  href="https://nodejs.org"
                  target="_blank"
                  rel="noreferrer"
                  className="focus-ring rounded-md text-accent hover:underline"
                >
                  Node.js 18 or newer
                </a>{' '}
                and{' '}
                <a
                  href="https://claude.com/claude-code"
                  target="_blank"
                  rel="noreferrer"
                  className="focus-ring rounded-md text-accent hover:underline"
                >
                  Claude Code
                </a>
                . To check, run <code className={code}>node --version</code> and{' '}
                <code className={code}>claude --version</code> in Terminal.
              </p>
            </Step>
            <Step n={2} title="Open Terminal">
              <p>
                Press <Kbd>⌘ Space</Kbd>, type <strong className="text-fg">Terminal</strong> and
                press Enter.
              </p>
            </Step>
            <Step n={3} title="Paste this command and press Enter">
              <CommandBlock command={command} label="Install command" />
              <p>
                It downloads the helper to <code className={code}>~/.squash</code> and sets it to
                start whenever you log in, so you only do this once. It finishes in a few seconds
                with <span className="text-fg">“Squash bridge installed and running.”</span>
              </p>
            </Step>
            <Step n={4} title="Allow the permission prompts">
              <p>
                The first time you send a bug, macOS asks to let{' '}
                <span className="text-fg">node</span> control{' '}
                <span className="text-fg">Terminal</span>: click OK. That is how the helper opens
                Claude in a new Terminal window. Chrome may also ask to let Squash reach your local
                network: click Allow.
              </p>
            </Step>
            <Step n={5} title="Send a bug to Claude">
              <p>
                Open a bug in your workspace and press{' '}
                <span className="text-fg">Send to Claude</span> (or <Kbd>C</Kbd>). The first time,
                pick the project folder Claude should work in. Each workspace keeps its own folder.
              </p>
            </Step>
          </ol>
        </section>

        <section className="mt-10 space-y-3">
          <h2 className="text-lg font-semibold">Following Claude’s progress</h2>
          <p className="text-sm leading-6 text-muted">
            Keep the bug open in Squash. A <span className="text-fg">Claude progress</span> panel
            under the title updates every couple of seconds with:
          </p>
          <ul className="list-disc space-y-1 pl-5 text-sm leading-6 text-muted">
            <li>
              Whether Claude is <span className="text-fg">working</span>,{' '}
              <span className="text-fg">needs you in Terminal</span> (to approve something or answer
              a question), <span className="text-fg">finished</span>, or closed.
            </li>
            <li>What it is doing right now, for example “Editing src/App.tsx”.</li>
            <li>Its plan as a checklist, and its latest message.</li>
            <li>Its summary of what it changed once it is done.</li>
          </ul>
          <p className="text-sm leading-6 text-muted">
            In the list, bugs Claude is working on show a pulsing Claude icon, amber when it is
            waiting for you. Progress stays on your computer, so only you see it, and only on the
            computer running the helper.
          </p>
        </section>

        <section className="mt-10 space-y-3">
          <h2 className="text-lg font-semibold">Troubleshooting</h2>
          <div className="divide-y divide-border rounded-xl border border-border px-4 text-sm leading-7">
            <details className="py-3">
              <summary className="focus-ring cursor-pointer rounded-md font-medium">
                No progress panel on the bug
              </summary>
              <div className="mt-2 text-muted">
                Use the check at the top of this page. If it says the helper can send bugs but needs
                an update, run the install command again, then send the bug again.
              </div>
            </details>
            <details className="py-3">
              <summary className="focus-ring cursor-pointer rounded-md font-medium">
                “The bridge did not start”
              </summary>
              <div className="mt-2 text-muted">
                Look at the log with <code className={code}>cat ~/.squash/bridge.log</code>. “Port
                4317 is busy” usually means a helper is already running: use the check at the top of
                this page to see which version.
              </div>
            </details>
            <details className="py-3">
              <summary className="focus-ring cursor-pointer rounded-md font-medium">
                “Claude Code is not on your PATH”
              </summary>
              <div className="mt-2 text-muted">
                Install Claude Code, open a new Terminal window, and run the install command again.
              </div>
            </details>
            <details className="py-3">
              <summary className="focus-ring cursor-pointer rounded-md font-medium">
                Check the helper by hand
              </summary>
              <div className="mt-2 text-muted">
                Run{' '}
                <code className={cn(code, 'break-all')}>
                  curl -H "Origin: {origin}" {BRIDGE_URL}/health
                </code>
                . A working helper answers with its version, which should be {AUTO_RESOLVE_VERSION}{' '}
                or higher.
              </div>
            </details>
            <details className="py-3">
              <summary className="focus-ring cursor-pointer rounded-md font-medium">Linux</summary>
              <div className="mt-2 text-muted">
                The same command works, but the helper runs in that terminal instead of at login, so
                leave it open. Claude runs in the background and its output goes to{' '}
                <code className={code}>claude.log</code> in the project’s{' '}
                <code className={code}>.squash/bugs</code> folder. Progress shows in Squash as
                usual.
              </div>
            </details>
          </div>
        </section>

        <section className="mt-10 space-y-3">
          <h2 className="text-lg font-semibold">Uninstall</h2>
          <p className="text-sm leading-6 text-muted">
            This stops the helper and removes it. Your folder choices stay in{' '}
            <code className={code}>~/.squash/bridge.json</code>.
          </p>
          <CommandBlock
            command={`curl -fsSL ${origin}/bridge/install.sh | sh -s -- --uninstall`}
            label="Uninstall command"
          />
        </section>
      </main>
      <footer className="mx-auto flex max-w-2xl flex-wrap items-center gap-5 border-t border-border px-6 py-6 text-sm text-muted">
        <Link to="/" className="focus-ring rounded-md hover:text-fg">
          Squash
        </Link>
        <nav aria-label="Footer" className="flex flex-wrap gap-5">
          <Link to="/claude" className="focus-ring rounded-md hover:text-fg">
            Claude Code guide
          </Link>
          <Link to="/privacy" className="focus-ring rounded-md hover:text-fg">
            Privacy
          </Link>
          <Link to="/terms" className="focus-ring rounded-md hover:text-fg">
            Terms
          </Link>
        </nav>
      </footer>
    </div>
  )
}
