import { ArrowRight, Check, Copy } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { facts } from '../marketing/facts'
import { cn } from '../../lib/utils'
import { keyLabel } from '../marketing/keyLabel'
import { MK_CONTAINER } from '../marketing/MarketingLayout'
import { Reveal } from '../marketing/Reveal'
import { githubUrl } from '../marketing/links'
import { Kbd } from '../ui'
import { LEDGER, SECURITY, SELF_HOST_STEPS, type SelfHostStep } from './content'
import { Band, SectionHead } from './Section'

/** Two-column definition list with hairline rules between rows (DESIGN.md section 5). */
function DefinitionLedger({ rows }: { rows: { term: string; body: string }[] }) {
  return (
    <dl className="border-b border-line">
      {rows.map((row) => (
        <div
          key={row.term}
          className="grid gap-1 border-t border-line py-4 sm:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] sm:gap-8"
        >
          <dt className="text-base font-medium">{row.term}</dt>
          <dd className="text-base text-pretty text-ink-2">{row.body}</dd>
        </div>
      ))}
    </dl>
  )
}

/** A section with its heading in a sticky left column and the content on the right. */
function SplitBand({
  id,
  headingId,
  eyebrow,
  title,
  intro,
  children,
}: {
  id?: string
  headingId: string
  eyebrow: string
  title: string
  intro: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <Band id={id} labelledBy={headingId}>
      <div className={cn(MK_CONTAINER, 'grid gap-10 lg:grid-cols-12 lg:gap-8')}>
        <Reveal className="lg:col-span-4">
          <SectionHead
            id={headingId}
            eyebrow={eyebrow}
            title={title}
            className="lg:sticky lg:top-28"
          >
            {intro}
          </SectionHead>
        </Reveal>
        <Reveal delay={80} className="lg:col-span-8 lg:col-start-5">
          {children}
        </Reveal>
      </div>
    </Band>
  )
}

function CopyBlock({ step }: { step: SelfHostStep }) {
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle')
  const timer = useRef<number | undefined>(undefined)
  useEffect(() => () => window.clearTimeout(timer.current), [])

  async function copy() {
    window.clearTimeout(timer.current)
    try {
      await navigator.clipboard.writeText(step.command)
      setState('copied')
    } catch {
      // Clipboard access can be denied (permissions, insecure origin); say so and let them select it.
      setState('failed')
    }
    timer.current = window.setTimeout(() => setState('idle'), 2000)
  }

  const shell = !step.command.includes('=')
  return (
    // The button sits beside the code, not over it, so a long line scrolls under a fade instead
    // of under the button.
    <div className="mt-4 flex items-start rounded-lg border border-line bg-surface-1">
      <pre className="mk-scroll-mask min-w-0 flex-1 overflow-x-auto py-3.5 pr-4 pl-4 text-sm leading-6 text-ink">
        <code>
          {step.command.split('\n').map((line) => (
            <span key={line} className="block">
              {shell && (
                <span aria-hidden="true" className="text-ink-3 select-none">
                  ${' '}
                </span>
              )}
              {line}
            </span>
          ))}
        </code>
      </pre>
      <button
        type="button"
        onClick={copy}
        aria-label={`Copy: ${step.title}`}
        className="t focus-ring m-1.5 inline-flex shrink-0 h-9 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium text-ink-2 hover:bg-surface-3 hover:text-ink max-sm:h-11"
      >
        {state === 'copied' ? (
          <Check size={14} aria-hidden="true" className="text-success" />
        ) : (
          <Copy size={14} aria-hidden="true" />
        )}
        <span aria-live="polite">
          {state === 'copied' ? 'Copied' : state === 'failed' ? 'Select to copy' : 'Copy'}
        </span>
      </button>
    </div>
  )
}

export function Depth() {
  const repo = githubUrl()
  const linkClass =
    't focus-ring inline-flex min-h-11 items-center gap-2 rounded-md text-sm font-medium text-accent hover:text-accent-strong'
  return (
    <>
      <SplitBand
        headingId="ledger-heading"
        eyebrow="Everything else"
        title="The rest of the drawer."
        intro={<p>No settings to configure first. All of it works on the hosted instance today.</p>}
      >
        <DefinitionLedger rows={LEDGER} />
      </SplitBand>

      <Band labelledBy="keys-heading">
        <div className={MK_CONTAINER}>
          <Reveal>
            <SectionHead id="keys-heading" eyebrow="Keyboard" title="Every action has a key.">
              <p>
                The same list the app shows when you press <Kbd>?</Kbd>.
              </p>
            </SectionHead>
          </Reveal>
          <Reveal delay={80}>
            <ul
              aria-label="Keyboard shortcuts"
              className="mt-10 grid grid-cols-1 border-t border-line sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
            >
              {facts.shortcuts.map((shortcut) => (
                <li
                  key={shortcut.label}
                  className="flex min-h-12 items-center justify-between gap-4 border-b border-line py-2 sm:pr-6"
                >
                  <span className="text-sm text-ink-2">
                    {shortcut.label.replace(/\s*\([^)]*\)/g, '')}
                  </span>
                  <span className="flex shrink-0 gap-1">
                    {shortcut.keys.map((key, i) => (
                      <Kbd key={i}>{keyLabel(key)}</Kbd>
                    ))}
                  </span>
                </li>
              ))}
            </ul>
          </Reveal>
        </div>
      </Band>

      <SplitBand
        headingId="security-heading"
        eyebrow="Security model"
        title="Enforced in Postgres."
        intro={
          <p>
            Squash is one public instance where strangers share infrastructure, so every rule lives
            in the database, not the browser.
          </p>
        }
      >
        <DefinitionLedger rows={SECURITY} />
        <div className="mt-4 flex flex-wrap gap-x-8">
          <a href={`${repo}/blob/main/supabase/tests/rls.sql`} className={linkClass}>
            Read the policy tests
            <ArrowRight size={16} aria-hidden="true" />
          </a>
          <a href={`${repo}/blob/main/SECURITY.md`} className={linkClass}>
            Report a vulnerability
            <ArrowRight size={16} aria-hidden="true" />
          </a>
        </div>
      </SplitBand>

      <SplitBand
        id="self-host"
        headingId="self-host-heading"
        eyebrow="Self-host"
        title="Self-host in 5 minutes."
        intro={
          <p>
            Node.js 24, a free Supabase project, and optionally Vercel. {facts.migrations} SQL
            migrations, no other services.
          </p>
        }
      >
        <ol className="border-b border-line">
          {SELF_HOST_STEPS.map((step, i) => (
            <li
              key={step.title}
              className="grid gap-2 border-t border-line py-6 sm:grid-cols-[3rem_minmax(0,1fr)]"
            >
              <span className="specimen-label pt-1 text-accent">
                {String(i + 1).padStart(2, '0')}
              </span>
              <div className="min-w-0">
                <h3 className="text-base font-medium">{step.title}</h3>
                <p className="mt-1 text-base text-ink-2">{step.body}</p>
                <CopyBlock step={step} />
              </div>
            </li>
          ))}
        </ol>
        <Link to="/docs/self-host" className={cn(linkClass, 'mt-4')}>
          Read the self-host guide
          <ArrowRight size={16} aria-hidden="true" />
        </Link>
      </SplitBand>
    </>
  )
}
