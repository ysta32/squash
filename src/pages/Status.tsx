import { ArrowUpRight, RefreshCw } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { MK_CONTAINER, MarketingLayout } from '../components/marketing/MarketingLayout'
import { PageHero } from '../components/marketing/PageHero'
import { usePageTitle } from '../components/marketing/usePageTitle'
import { Button, SpecimenLabel } from '../components/ui'
import {
  checkApp,
  checkRealtime,
  checkRest,
  statusConfig,
  type CheckResult,
  type StatusConfig,
} from '../lib/statusChecks'
import { cn } from '../lib/utils'

interface CheckDef {
  id: 'app' | 'rest' | 'realtime'
  name: string
  what: string
  run: (config: StatusConfig) => Promise<CheckResult>
}

const CHECKS: CheckDef[] = [
  {
    id: 'app',
    name: 'App',
    what: 'This site’s own server, which delivers the app.',
    run: (config) => checkApp(config),
  },
  {
    id: 'rest',
    name: 'Database API',
    what: 'Supabase REST, which loads and saves bugs.',
    run: (config) => checkRest(config),
  },
  {
    id: 'realtime',
    name: 'Live updates',
    what: 'Supabase Realtime, which pushes changes and presence.',
    run: (config) => checkRealtime(config),
  },
]

type Results = Partial<Record<CheckDef['id'], CheckResult>>

const STATE_LABEL: Record<CheckResult['state'] | 'checking', string> = {
  ok: 'Reachable',
  down: 'Not reachable',
  unconfigured: 'Not configured',
  checking: 'Checking…',
}

function Glyph({ state }: { state: CheckResult['state'] | 'checking' }) {
  // Status glyphs from the app: hollow ring (pending), filled check (ok), cross (down).
  if (state === 'ok') {
    return (
      <svg viewBox="0 0 16 16" className="size-4 text-success" aria-hidden="true">
        <circle cx="8" cy="8" r="7" fill="currentColor" />
        <path
          d="M5 8.2 7 10.2 11 6"
          fill="none"
          stroke="var(--surface-2)"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    )
  }
  if (state === 'down') {
    return (
      <svg viewBox="0 0 16 16" className="size-4 text-danger" aria-hidden="true">
        <circle cx="8" cy="8" r="7" fill="currentColor" />
        <path
          d="M5.5 5.5 10.5 10.5M10.5 5.5 5.5 10.5"
          stroke="var(--surface-2)"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
      </svg>
    )
  }
  return (
    <svg viewBox="0 0 16 16" className="size-4 text-ink-3" aria-hidden="true">
      <circle
        cx="8"
        cy="8"
        r="6.25"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeDasharray={state === 'checking' ? '3 2.5' : undefined}
      />
    </svg>
  )
}

function summary(results: Results, running: boolean): string {
  if (running) return 'Checking from your browser…'
  const values = Object.values(results)
  const down = values.filter((r) => r.state === 'down').length
  const skipped = values.filter((r) => r.state === 'unconfigured').length
  if (down === 0 && skipped === 0) return 'Everything answered.'
  if (down === 0)
    return `Reachable. ${skipped} of ${CHECKS.length} checks are not configured on this build.`
  return `${down} of ${CHECKS.length} ${down === 1 ? 'check' : 'checks'} failed from your browser.`
}

export default function Status() {
  usePageTitle('Status')
  const [results, setResults] = useState<Results>({})
  const [running, setRunning] = useState(true)
  const [checkedAt, setCheckedAt] = useState<Date | null>(null)
  const run = useRef(0)

  // Starts one round of checks; state is only set from their callbacks.
  const start = useCallback(() => {
    const id = ++run.current
    const config = statusConfig(import.meta.env, window.location.origin)
    void Promise.all(
      CHECKS.map((check) =>
        check
          .run(config)
          .catch((error: unknown): CheckResult => ({
            state: 'down',
            ms: null,
            detail: error instanceof Error ? error.message : String(error),
          }))
          .then((result) => {
            if (run.current === id) setResults((prev) => ({ ...prev, [check.id]: result }))
          }),
      ),
    ).then(() => {
      if (run.current !== id) return
      setRunning(false)
      setCheckedAt(new Date())
    })
  }, [])

  const runAll = () => {
    setRunning(true)
    setResults({})
    start()
  }

  useEffect(() => {
    // The first round starts in the initial "checking" state.
    start()
    const counter = run
    return () => {
      // A result arriving after the page is left is dropped.
      counter.current++
    }
  }, [start])

  const anyDown = Object.values(results).some((r) => r.state === 'down')

  return (
    <MarketingLayout>
      <PageHero
        eyebrow={['Status', 'Checked from your browser', 'Now']}
        title="Is Squash reachable right now?"
      >
        <p>
          This page doesn’t report someone else’s dashboard. Your browser contacts each service that
          Squash depends on, right now, and times the answer. If something fails here and on the
          provider status pages, it is not your network.
        </p>
      </PageHero>

      <section aria-labelledby="checks-heading" className="border-t border-line py-14 lg:py-20">
        <div className={cn(MK_CONTAINER, 'grid gap-10 lg:grid-cols-12 lg:gap-8')}>
          <div className="lg:col-span-8">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <SpecimenLabel
                  segments={[
                    'Checked from your browser',
                    checkedAt ? (
                      <time key="t" dateTime={checkedAt.toISOString()}>
                        {checkedAt.toLocaleTimeString(undefined, {
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit',
                        })}
                      </time>
                    ) : (
                      'Now'
                    ),
                  ]}
                  className="text-ink-3"
                />
                <h2
                  id="checks-heading"
                  aria-live="polite"
                  className={cn(
                    'mt-2 text-2xl font-semibold tracking-[-0.02em]',
                    anyDown && !running && 'text-danger',
                  )}
                >
                  {summary(results, running)}
                </h2>
              </div>
              <Button onClick={runAll} disabled={running} aria-busy={running}>
                <RefreshCw size={16} aria-hidden="true" />
                {running ? 'Checking…' : 'Check again'}
              </Button>
            </div>

            <ul className="mt-8 overflow-hidden rounded-xl border border-line-2 bg-surface-2 shadow-elev-2">
              {CHECKS.map((check) => {
                const result = results[check.id]
                const state = result?.state ?? 'checking'
                return (
                  <li
                    key={check.id}
                    className="grid grid-cols-[1rem_minmax(0,1fr)_auto] items-start gap-x-4 gap-y-1 border-t border-line px-5 py-5 first:border-t-0 sm:px-6"
                  >
                    <span className="pt-1">
                      <Glyph state={state} />
                    </span>
                    <div className="min-w-0">
                      <p className="text-base font-medium">{check.name}</p>
                      <p className="mt-0.5 text-sm text-ink-2">{check.what}</p>
                      <p
                        className={cn(
                          'mt-2 text-sm',
                          state === 'down' ? 'text-danger' : 'text-ink-3',
                        )}
                      >
                        <span className="font-medium">{STATE_LABEL[state]}</span>
                        {result && <> · {result.detail}</>}
                      </p>
                    </div>
                    <p className="pt-0.5 text-right font-mono text-lg font-medium text-ink tabular-nums">
                      {result?.ms != null ? (
                        <>
                          {result.ms}
                          <span className="ml-1 text-xs text-ink-3">ms</span>
                        </>
                      ) : (
                        <span className="text-ink-3" aria-label="No time">
                          —
                        </span>
                      )}
                    </p>
                  </li>
                )
              })}
            </ul>
            <p className="mt-4 max-w-[60ch] text-sm text-ink-3">
              Times include your own connection, so they vary by network and location. An ad blocker
              or a corporate proxy can make a check fail even when the service is up.
            </p>
          </div>

          <aside aria-labelledby="providers-heading" className="lg:col-span-4">
            <p className="specimen-label text-ink-3">Providers</p>
            <h2 id="providers-heading" className="mt-2 text-lg font-semibold">
              The services underneath
            </h2>
            <p className="mt-2 text-sm text-pretty text-ink-2">
              The app is served by Vercel; data, sign-in, storage and live updates run on Supabase.
              Their own status pages report incidents in their regions.
            </p>
            <ul className="mt-4 border-b border-line">
              {[
                { name: 'Vercel status', href: 'https://www.vercel-status.com' },
                { name: 'Supabase status', href: 'https://status.supabase.com' },
              ].map((link) => (
                <li key={link.href} className="border-t border-line">
                  <a
                    href={link.href}
                    className="t focus-ring-inset group flex h-12 items-center justify-between text-sm font-medium hover:text-accent"
                  >
                    {link.name}
                    <ArrowUpRight
                      size={16}
                      aria-hidden="true"
                      className="t text-ink-3 group-hover:text-accent"
                    />
                  </a>
                </li>
              ))}
            </ul>
            <p className="mt-4 text-sm text-ink-3">
              There is no uptime guarantee: Squash is an open-source project offered as is.
            </p>
          </aside>
        </div>
      </section>
    </MarketingLayout>
  )
}
