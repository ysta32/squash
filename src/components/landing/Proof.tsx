import { Fragment } from 'react'
import { ArrowRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { facts } from '../marketing/facts'
import { cn } from '../../lib/utils'
import { MK_CONTAINER } from '../marketing/MarketingLayout'
import { Reveal } from '../marketing/Reveal'
import { githubUrl } from '../marketing/links'
import { SpecimenLabel } from '../ui'
import { Band, SectionHead } from './Section'

/** A repository path that may wrap after each slash, never mid-name, in a narrow column. */
function path(p: string) {
  return p.split('/').map((part, i, all) => (
    <Fragment key={i}>
      {part}
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
      source: [`${facts.testFiles} test files in src`],
    },
    {
      value: String(facts.rlsChecks),
      term: 'Row Level Security checks',
      source: [path('supabase/tests/rls.sql'), 'every pull request'],
    },
    {
      value: String(facts.releases),
      term: 'Tagged releases',
      source: [
        `${facts.firstRelease.version} ${facts.firstRelease.date} → ${facts.latestRelease.version}`,
      ],
    },
    {
      value: `${facts.budgetEntryKb} kB`,
      term: 'Entry script budget, gzip',
      source: [path('scripts/size-check.mjs'), 'fails CI'],
    },
    {
      value: facts.license,
      term: 'License',
      source: ['Read it, fork it, run it'],
    },
  ]
}

export function Proof() {
  const linkClass =
    't focus-ring inline-flex min-h-11 items-center gap-2 rounded-md text-sm font-medium text-accent hover:text-accent-strong'
  return (
    <Band labelledBy="record-heading">
      <div className={MK_CONTAINER}>
        <Reveal>
          <SectionHead id="record-heading" eyebrow="The record" title="Checked, not claimed.">
            <p>Every number here is counted from the repository when this page is built.</p>
          </SectionHead>
        </Reveal>
        <Reveal delay={80}>
          <dl className="mt-12 grid grid-cols-2 gap-x-8 sm:grid-cols-3 xl:grid-cols-5">
            {records().map((record, i) => (
              <div
                key={record.term}
                className={cn(
                  'flex flex-col border-t border-line-2 pt-5 pb-8',
                  i === 4 && 'max-sm:col-span-2',
                )}
              >
                <dt className="order-2 mt-3 text-sm font-medium">{record.term}</dt>
                <dd className="order-1 text-[2.5rem]/none font-semibold tracking-[-0.03em] tabular-nums lg:text-display-m">
                  {record.value}
                </dd>
                <dd className="order-3 mt-1">
                  <SpecimenLabel as="div" segments={record.source} className="text-ink-3" />
                </dd>
              </div>
            ))}
          </dl>
          <div className="mt-4 flex flex-wrap gap-x-8">
            <Link to="/changelog" className={linkClass}>
              Read the changelog
              <ArrowRight size={16} aria-hidden="true" />
            </Link>
            <a href={githubUrl()} className={linkClass}>
              Browse the source
              <ArrowRight size={16} aria-hidden="true" />
            </a>
          </div>
        </Reveal>
      </div>
    </Band>
  )
}
