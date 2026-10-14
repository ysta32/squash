import { useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Hero } from '../components/landing/Hero'
import { Stage } from '../components/landing/Stage'
import '../components/landing/lp.css'
import { facts } from '../components/marketing/facts'
import { githubUrl } from '../components/marketing/links'
import {
  MK_CONTAINER,
  MarketingLayout,
  OpenWorkspaceLink,
} from '../components/marketing/MarketingLayout'
import { buttonClass } from '../components/ui'

/** Router links that change only the hash bring that section into view. */
function useHashScroll() {
  const { hash } = useLocation()
  useEffect(() => {
    if (!hash) return
    const target = document.getElementById(decodeURIComponent(hash.slice(1)))
    target?.scrollIntoView({ block: 'start' })
  }, [hash])
}

/** The drafting guides the whole page is set against, running the height of the window. */
function Guides() {
  return (
    <div aria-hidden="true" className="lp-guides">
      <div>
        <span />
        <span />
        <span />
        <span />
      </div>
    </div>
  )
}

/** Four numbers counted from the repository when this page is built, not typed in by hand. */
function Counted() {
  const rows = [
    [String(facts.tests), 'unit tests'],
    [String(facts.rlsChecks), 'Row Level Security checks'],
    [facts.license, 'licensed'],
    [facts.latestRelease.version, `released ${facts.latestRelease.date}`],
  ]
  return (
    <dl className="mt-16 grid border-t border-ink sm:grid-cols-4">
      {rows.map(([value, term]) => (
        <div
          key={term}
          className="border-b border-line py-5 sm:border-b-0 sm:border-l sm:pl-5 sm:first:border-l-0 sm:first:pl-0"
        >
          <dd className="lp-display text-[1.9rem]">{value}</dd>
          <dt className="lp-small mt-1">{term}</dt>
        </div>
      ))}
    </dl>
  )
}

/** The last screen: what it costs, what it runs on, and the two ways in. */
function Close() {
  const link =
    't focus-ring inline-flex min-h-11 items-center text-base font-medium underline decoration-markup decoration-2 underline-offset-4'
  return (
    <section aria-labelledby="close-heading" className="border-t border-line py-20 lg:py-28">
      <div className={MK_CONTAINER}>
        <h2 id="close-heading" className="lp-display lp-h1 max-w-[11ch]">
          File the next one here.
        </h2>
        <p className="lp-read mt-8">
          Free on the hosted instance, no paid tier, no trackers. MIT licensed, and it runs on a
          free Supabase project in about five minutes if you would rather host it yourself.
        </p>
        <div className="mt-8 flex flex-wrap items-center gap-3">
          <OpenWorkspaceLink size="lg" />
          <Link to="/docs/self-host" className={buttonClass('secondary', 'lg')}>
            Self-host it
          </Link>
        </div>
        <div className="mt-10 flex flex-wrap gap-x-10 gap-y-1">
          <Link to="/features" className={link}>
            Everything it does
          </Link>
          <a href={githubUrl()} className={link}>
            Read the source
          </a>
        </div>
        <Counted />
      </div>
    </section>
  )
}

/**
 * The home page is three screens long: what Squash is, bug #24 living its whole life under the
 * scroll, and the way in. Everything else it could say lives on /features and /docs.
 */
export default function Landing() {
  useHashScroll()
  return (
    <MarketingLayout surface="lp">
      <Guides />
      <div className="lp-above">
        <Hero />
        <Stage />
        <Close />
      </div>
    </MarketingLayout>
  )
}
