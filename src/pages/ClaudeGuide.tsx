import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { Check, ChevronRight, Copy, RefreshCw } from 'lucide-react'
import {
  BRIDGE_URL,
  BRIDGE_VERSION,
  PROGRESS_VERSION,
  AUTO_RESOLVE_VERSION,
  HARDENED_VERSION,
  PROOF_VERSION,
  installCommand,
  pingBridge,
  type BridgeStatus,
} from '../lib/claudeExport'
import { cn } from '../lib/utils'
import type { DocHeading } from '../components/marketing/content-types'
import { DocsLayout } from '../components/marketing/DocsLayout'
import { usePageTitle } from '../components/marketing/usePageTitle'
import { Button, Kbd, proseLinkClass } from '../components/ui'

const POLL_MS = 2000

/** Section outline for the docs layout (ids on the h2s below). */
const GUIDE_HEADINGS: DocHeading[] = [
  { id: 'how-it-works', text: 'How it works', level: 2 },
  { id: 'install', text: 'Install or update', level: 2 },
  { id: 'progress', text: 'Following Claude’s progress', level: 2 },
  { id: 'troubleshooting', text: 'Troubleshooting', level: 2 },
  { id: 'uninstall', text: 'Uninstall', level: 2 },
]

/**
 * A terminal command with a copy button. Long commands scroll sideways inside the block (never
 * wrap, so they paste exactly), with a fade on whichever edge has more command beyond it.
 */
export function CommandBlock({ command, label }: { command: string; label: string }) {
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const scroller = useRef<HTMLPreElement>(null)
  const [edges, setEdges] = useState({ start: false, end: false })

  const measure = useCallback(() => {
    const node = scroller.current
    if (!node) return
    const max = node.scrollWidth - node.clientWidth
    setEdges({ start: node.scrollLeft > 1, end: max - node.scrollLeft > 1 })
  }, [])

  useLayoutEffect(() => {
    measure()
    const node = scroller.current
    if (!node || typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', measure)
      return () => window.removeEventListener('resize', measure)
    }
    const observer = new ResizeObserver(measure)
    observer.observe(node)
    return () => observer.disconnect()
  }, [measure, command])

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
      <div className="flex min-w-0 items-stretch overflow-hidden rounded-md border border-line-2 bg-surface-1">
        <pre
          ref={scroller}
          // Focusable so keyboard users can scroll a long command.
          tabIndex={0}
          aria-label={label}
          onScroll={measure}
          data-fade-start={edges.start || undefined}
          data-fade-end={edges.end || undefined}
          className={cn(
            'focus-ring-inset min-w-0 flex-1 overflow-x-auto px-3 py-2.5 font-mono text-xs leading-5 whitespace-pre text-ink [scrollbar-width:thin]',
            '[--fade-l:black] [--fade-r:black] data-fade-end:[--fade-r:transparent] data-fade-start:[--fade-l:transparent]',
            '[mask-image:linear-gradient(to_right,var(--fade-l),black_24px,black_calc(100%-24px),var(--fade-r))]',
          )}
        >
          <code>{command}</code>
        </pre>
        <button
          type="button"
          onClick={() => void copy()}
          className="t focus-ring-inset flex min-h-11 shrink-0 items-center gap-1.5 border-l border-line px-3 text-sm font-medium text-ink hover:bg-surface-3 sm:min-h-9"
        >
          {copied ? (
            <Check className="size-4" strokeWidth={1.5} absoluteStrokeWidth aria-hidden="true" />
          ) : (
            <Copy className="size-4" strokeWidth={1.5} absoluteStrokeWidth aria-hidden="true" />
          )}
          <span aria-live="polite">{copied ? 'Copied' : 'Copy'}</span>
        </button>
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
                : status.version < HARDENED_VERSION
                  ? [
                      'bg-warning',
                      `Helper v${status.version} is running. Run the command below to update it: the new helper pins screenshot downloads to this app’s Supabase storage host and limits how many Claude runs start at once.`,
                    ]
                  : status.version < PROOF_VERSION
                    ? [
                        'bg-warning',
                        `Helper v${status.version} is running. Run the command below to update it so each fix Claude finishes records its commit, branch, pull request and diff on the bug.`,
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
      <span className="w-6 shrink-0 pt-px font-mono text-xs leading-6 text-accent nums">
        {String(n).padStart(2, '0')}
      </span>
      <div className="min-w-0 flex-1">
        <h3 className="font-medium">{title}</h3>
        <div className="mt-1 space-y-2 text-sm leading-6 text-muted">{children}</div>
      </div>
    </li>
  )
}

/** Inline code: one line (a command never breaks mid-word), except `codeLong` for long paths. */
const codeBase = 'rounded-sm border border-line bg-surface-1 px-1 py-px font-mono text-xs text-ink'
const code = `${codeBase} whitespace-nowrap`
const codeLong = `${codeBase} break-all`

/** One troubleshooting row: a full-width summary with a chevron that turns when it opens. */
function Disclosure({ title, children }: { title: ReactNode; children: ReactNode }) {
  return (
    <details className="group">
      <summary className="t focus-ring-inset -mx-4 flex min-h-12 cursor-pointer list-none items-center gap-3 px-4 py-2.5 font-medium text-ink select-none hover:bg-surface-3/60 [&::-webkit-details-marker]:hidden">
        <span className="min-w-0 flex-1">{title}</span>
        <ChevronRight
          className="t size-4 shrink-0 text-ink-3 group-open:rotate-90"
          strokeWidth={1.5}
          absoluteStrokeWidth
          aria-hidden="true"
        />
      </summary>
      <div className="pb-4 text-ink-2">{children}</div>
    </details>
  )
}

export default function ClaudeGuide() {
  usePageTitle('Claude Code helper')
  const origin = window.location.origin
  const command = installCommand(origin)

  return (
    <DocsLayout current="claude" headings={GUIDE_HEADINGS}>
      <div className="text-base leading-7">
        <p className="max-w-[68ch] text-read text-ink-2">
          The helper is a small program on your computer that lets Squash open Claude Code on a bug,
          with its screenshots, in your project folder. While Claude works, the helper reports back
          so the bug in Squash shows what Claude is doing: its current step, its plan, and its
          summary when it is done.
        </p>

        <section className="mt-8 rounded-xl border border-border bg-bg-subtle p-5">
          <h2 id="how-it-works" className="scroll-mt-24 text-xl font-semibold tracking-[-0.015em]">
            How it works
          </h2>
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
          <h2 id="install" className="scroll-mt-24 text-xl font-semibold tracking-[-0.015em]">
            Install or update
          </h2>
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
                  className={proseLinkClass}
                >
                  Node.js 18 or newer
                </a>{' '}
                and{' '}
                <a
                  href="https://claude.com/claude-code"
                  target="_blank"
                  rel="noreferrer"
                  className={proseLinkClass}
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
          <h2 id="progress" className="scroll-mt-24 text-xl font-semibold tracking-[-0.015em]">
            Following Claude’s progress
          </h2>
          <p className="text-sm leading-6 text-muted">
            Keep the bug open in Squash. A <span className="text-fg">Claude progress</span> panel
            under the title updates every couple of seconds with:
          </p>
          <ul className="space-y-1 text-sm leading-6 text-muted [&>li]:relative [&>li]:pl-5 [&>li]:before:absolute [&>li]:before:left-0 [&>li]:before:font-mono [&>li]:before:text-ink-3 [&>li]:before:content-['–']">
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
          <h2
            id="troubleshooting"
            className="scroll-mt-24 text-xl font-semibold tracking-[-0.015em]"
          >
            Troubleshooting
          </h2>
          <div className="divide-y divide-line rounded-xl border border-line px-4 text-sm leading-7">
            <Disclosure title="No progress panel on the bug">
              Use the check at the top of this page. If it says the helper can send bugs but needs
              an update, run the install command again, then send the bug again.
            </Disclosure>
            <Disclosure title="“The bridge did not start”">
              Look at the log with <code className={code}>cat ~/.squash/bridge.log</code>. “Port
              4317 is busy” usually means a helper is already running: use the check at the top of
              this page to see which version.
            </Disclosure>
            <Disclosure title="“Claude Code is not on your PATH”">
              Install Claude Code, open a new Terminal window, and run the install command again.
            </Disclosure>
            <Disclosure title="“Screenshot URLs must be https links to Supabase storage”">
              The installer pins screenshot downloads to this app’s Supabase host. Download paths
              must start with <code className={code}>/storage/v1/object/</code>. Older installs
              without a pinned host allow any Supabase project; run the install command again to
              update them. To allow another storage host, start the helper with{' '}
              <code className={codeLong}>SQUASH_DOWNLOAD_HOSTS=files.example.com</code> (a
              comma-separated list of exact host names).
            </Disclosure>
            <Disclosure title="Check the helper by hand">
              Run{' '}
              <code className={codeLong}>
                curl -H "Origin: {origin}" {BRIDGE_URL}/health
              </code>
              . A working helper answers with its version, which should be {HARDENED_VERSION} or
              higher.
            </Disclosure>
            <Disclosure title="Linux">
              The same command works, but the helper runs in that terminal instead of at login, so
              leave it open. Claude runs in the background and its output goes to{' '}
              <code className={code}>claude.log</code> in the project’s{' '}
              <code className={code}>.squash/bugs</code> folder. Progress shows in Squash as usual.
            </Disclosure>
          </div>
        </section>

        <section className="mt-10 space-y-3">
          <h2 id="uninstall" className="scroll-mt-24 text-xl font-semibold tracking-[-0.015em]">
            Uninstall
          </h2>
          <p className="text-sm leading-6 text-muted">
            This stops the helper and removes it. Your folder choices stay in{' '}
            <code className={code}>~/.squash/bridge.json</code>.
          </p>
          <CommandBlock
            command={`curl -fsSL ${origin}/bridge/install.sh | sh -s -- --uninstall`}
            label="Uninstall command"
          />
        </section>
      </div>
    </DocsLayout>
  )
}
