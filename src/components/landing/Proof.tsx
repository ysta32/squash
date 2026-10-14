import { Fragment } from 'react'
import { Link } from 'react-router-dom'
import { facts } from '../marketing/facts'
import { Reveal } from '../marketing/Reveal'
import { githubUrl } from '../marketing/links'
import { cn } from '../../lib/utils'
import { MK_CONTAINER } from '../marketing/MarketingLayout'
import { Band, EntryHead } from './Section'

/**
 * A repository path that may wrap after each slash, never mid-name (not even at the hyphen in
 * `size-check.mjs`), in a narrow column.
 */
function path(p: string) {
  return p.split('/').map((part, i, all) => (
    <Fragment key={i}>
      <span className="whitespace-nowrap">{part}</span>
      {i < all.length - 1 && (
        <>
          /<wbr />
        </>
      )}
    </Fragment>
  ))
}

/** Real numbers only, counted from the repository when the page is built (vite-plugin-facts.ts). */
function records() {
  return [
    {
      value: String(facts.tests),
      term: 'Unit tests',
      source: <>{facts.testFiles} test files in src</>,
    },
    {
      value: String(facts.rlsChecks),
      term: 'Row Level Security checks',
      source: <>{path('supabase/tests/rls.sql')}, run on every pull request</>,
    },
    {
      value: String(facts.releases),
      term: 'Tagged releases',
      source: (
        <>
          {facts.firstRelease.version} on {facts.firstRelease.date}, now at{' '}
          {facts.latestRelease.version}
        </>
      ),
    },
    {
      value: `${facts.budgetEntryKb} kB`,
      term: 'Entry script budget, gzip',
      source: <>{path('scripts/size-check.mjs')} fails the build when it is passed</>,
    },
    {
      value: facts.license,
      term: 'License',
      source: <>Read it, fork it, run it</>,
    },
  ]
}

export function Proof() {
  const linkClass =
    't focus-ring inline-flex min-h-11 items-center rounded-md text-sm font-medium text-accent underline decoration-accent/40 underline-offset-4 hover:decoration-accent'
  return (
    <Band labelledBy="record-heading">
      <div className={cn(MK_CONTAINER)}>
        <Reveal>
          <EntryHead id="record-heading" mark="the numbers" title="Checked, not claimed.">
            <p>
              Every number here is counted from the repository when this page is built. None of them
              are typed in by hand.
            </p>
          </EntryHead>
        </Reveal>
        <Reveal delay={80}>
          <dl className="mt-10 border-t border-line-2">
            {records().map((record) => (
              <div
                key={record.term}
                className="grid grid-cols-[minmax(4.5rem,auto)_minmax(0,1fr)] items-baseline gap-x-5 gap-y-1 border-b border-line py-5 sm:grid-cols-[7rem_minmax(0,18rem)_minmax(0,1fr)] sm:gap-x-8"
              >
                <dt className="col-start-2 row-start-1 text-base font-medium">{record.term}</dt>
                <dd className="lp-display col-start-1 row-span-2 row-start-1 text-[2.1rem] leading-none tabular-nums sm:row-span-1 sm:text-[2.4rem]">
                  {record.value}
                </dd>
                <dd
                  className={cn(
                    'col-start-2 row-start-2 text-sm leading-6 text-ink-3 sm:col-start-3 sm:row-start-1',
                  )}
                >
                  {record.source}
                </dd>
              </div>
            ))}
          </dl>
          <div className="mt-6 flex flex-wrap gap-x-8 gap-y-1">
            <Link to="/changelog" className={linkClass}>
              Read the changelog
            </Link>
            <a href={githubUrl()} className={linkClass}>
              Browse the source
            </a>
          </div>
        </Reveal>
      </div>
    </Band>
  )
}
