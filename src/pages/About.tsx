import { ArrowRight, ArrowUpRight } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { SectionHead } from '../components/landing/Section'
import { arrowLinkClass } from '../components/marketing/ActionBand'
import { facts } from '../components/marketing/facts'
import { githubUrl } from '../components/marketing/links'
import {
  MK_CONTAINER,
  MarketingLayout,
  OpenWorkspaceLink,
} from '../components/marketing/MarketingLayout'
import { PageHero } from '../components/marketing/PageHero'
import { Reveal } from '../components/marketing/Reveal'
import { usePageTitle } from '../components/marketing/usePageTitle'
import { buttonClass, proseLinkClass } from '../components/ui'
import { cn } from '../lib/utils'

/** The repository owner (package.json "repository"); nothing else about the maintainer is claimed. */
const MAINTAINER = 'ysta32'

const CHECKS = [
  'npm run typecheck',
  'npm run lint',
  'npm run format:check',
  'npm run test',
  'npm run test:db',
  'npm run build',
]

function Record() {
  const rows: { term: string; value: ReactNode }[] = [
    { term: 'License', value: facts.license },
    {
      term: 'Maintainer',
      value: (
        <a href={`https://github.com/${MAINTAINER}`} className={proseLinkClass}>
          @{MAINTAINER}
        </a>
      ),
    },
    {
      term: 'First release',
      value: `${facts.firstRelease.version} · ${facts.firstRelease.date}`,
    },
    {
      term: 'Latest release',
      value: `${facts.latestRelease.version} · ${facts.latestRelease.date}`,
    },
    { term: 'Releases', value: facts.releases },
    { term: 'Unit tests', value: facts.tests },
    { term: 'Database policy checks', value: facts.rlsChecks },
  ]
  return (
    <div className="rounded-xl border border-line-2 bg-surface-2 p-6 shadow-elev-2 sm:p-8">
      <p className="specimen-label text-ink-3">The record · counted at build time</p>
      <dl className="mt-4 border-b border-line">
        {rows.map((row) => (
          <div
            key={row.term}
            className="flex items-baseline justify-between gap-4 border-t border-line py-2.5"
          >
            <dt className="text-sm text-ink-2">{row.term}</dt>
            <dd className="font-mono text-sm text-ink tabular-nums">{row.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

const DECISIONS: { term: string; body: ReactNode }[] = [
  {
    term: 'Issues first',
    body: 'Bugs and feature requests start as GitHub issues, from the repository’s templates. Security reports go to a private advisory instead.',
  },
  {
    term: 'Pull requests, checked by CI',
    body: 'Every change lands as a pull request. CI type-checks, lints, runs the unit and database tests, builds, enforces the bundle-size budget, and runs CodeQL.',
  },
  {
    term: 'Design in the open',
    body: (
      <>
        The visual direction, tokens and voice are written down in{' '}
        <a href={`${githubUrl()}/blob/main/DESIGN.md`} className={proseLinkClass}>
          DESIGN.md
        </a>
        , in the repository with the code.
      </>
    ),
  },
  {
    term: 'Shipped means logged',
    body: (
      <>
        What changed, and which migrations a release needs, goes in the{' '}
        <Link to="/changelog" className={proseLinkClass}>
          changelog
        </Link>
        .
      </>
    ),
  },
]

export default function About() {
  usePageTitle('About')
  const repo = githubUrl()
  return (
    <MarketingLayout>
      <PageHero
        eyebrow={['About', facts.license, `Since ${facts.firstRelease.date}`]}
        title="An open-source bug tracker for small teams."
        aside={<Record />}
      >
        <p>
          Squash is a bug tracker for teams of 2–10 people, built in the open on GitHub and released
          under the {facts.license} license. It is maintained by{' '}
          <a href={`https://github.com/${MAINTAINER}`} className={proseLinkClass}>
            @{MAINTAINER}
          </a>
          . Anyone can read the code, run their own copy, or send a change.
        </p>
      </PageHero>

      <section aria-labelledby="decisions-heading" className="border-t border-line py-16 lg:py-24">
        <div className={cn(MK_CONTAINER, 'grid gap-10 lg:grid-cols-12 lg:gap-8')}>
          <Reveal className="lg:col-span-4">
            <SectionHead id="decisions-heading" eyebrow="How it is run" title="Decided in public.">
              <p>
                The repository is the record: issues, pull requests, the design document and the
                changelog.
              </p>
            </SectionHead>
          </Reveal>
          <Reveal delay={80} className="lg:col-span-8">
            <dl className="border-b border-line">
              {DECISIONS.map((row) => (
                <div
                  key={row.term}
                  className="grid gap-1 border-t border-line py-4 sm:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] sm:gap-8"
                >
                  <dt className="text-base font-medium">{row.term}</dt>
                  <dd className="text-base text-pretty text-ink-2">{row.body}</dd>
                </div>
              ))}
            </dl>
          </Reveal>
        </div>
      </section>

      <section aria-labelledby="contribute-heading" className="border-t border-line py-16 lg:py-24">
        <div className={cn(MK_CONTAINER, 'grid gap-10 lg:grid-cols-12 lg:gap-8')}>
          <Reveal className="lg:col-span-4">
            <SectionHead id="contribute-heading" eyebrow="Contribute" title="Send a change.">
              <p>
                Issues and pull requests are welcome. Keep a pull request focused, describe what a
                user will notice, and include screenshots for visual changes.
              </p>
            </SectionHead>
          </Reveal>
          <Reveal delay={80} className="lg:col-span-8">
            <ol className="border-b border-line">
              {[
                {
                  title: 'Set up',
                  body: 'Node.js 24 or newer and npm. Configure Supabase and your .env as in the self-host guide, then install and start the dev server.',
                  command: 'npm ci\nnpm run dev',
                },
                {
                  title: 'Check before you push',
                  body: 'The same checks CI runs on every pull request.',
                  command: CHECKS.join('\n'),
                },
                {
                  title: 'Open the pull request',
                  body: 'Strict TypeScript, no any, Lucide icons, the existing tokens. Never commit .env or credentials.',
                  command: null,
                },
              ].map((step, i) => (
                <li
                  key={step.title}
                  className="grid gap-2 border-t border-line py-6 sm:grid-cols-[3rem_minmax(0,1fr)]"
                >
                  <span className="specimen-label pt-1 text-accent">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <div className="min-w-0">
                    <h3 className="text-base font-medium">{step.title}</h3>
                    <p className="mt-1 text-base text-pretty text-ink-2">{step.body}</p>
                    {step.command && (
                      <pre className="mt-4 overflow-x-auto rounded-lg border border-line bg-surface-1 px-4 py-3.5 text-sm leading-6 text-ink">
                        <code>{step.command}</code>
                      </pre>
                    )}
                  </div>
                </li>
              ))}
            </ol>
            <div className="mt-4 flex flex-wrap gap-x-8">
              <a href={`${repo}/blob/main/CONTRIBUTING.md`} className={arrowLinkClass}>
                Read CONTRIBUTING.md
                <ArrowRight size={16} aria-hidden="true" />
              </a>
              <Link to="/docs/self-host" className={arrowLinkClass}>
                Self-host guide
                <ArrowRight size={16} aria-hidden="true" />
              </Link>
            </div>
          </Reveal>
        </div>
      </section>

      <section aria-labelledby="about-action" className="cabinet-light border-t border-line">
        <div className={cn(MK_CONTAINER, 'py-20 lg:py-28')}>
          <p className="specimen-label text-ink-3">Start</p>
          <h2
            id="about-action"
            className="mt-3 max-w-[20ch] text-[2.25rem]/[2.5rem] font-semibold tracking-[-0.03em] text-balance sm:text-display-m"
          >
            Read the code, or use it.
          </h2>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <a href={repo} className={buttonClass('secondary', 'lg')}>
              View on GitHub
              <ArrowUpRight size={16} aria-hidden="true" />
            </a>
            <OpenWorkspaceLink size="lg" />
          </div>
        </div>
      </section>
    </MarketingLayout>
  )
}
