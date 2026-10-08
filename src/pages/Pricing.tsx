import { ArrowRight, Check, Minus } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ActionBand, arrowLinkClass } from '../components/marketing/ActionBand'
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
import { SectionHead } from '../components/landing/Section'
import { buttonClass } from '../components/ui'
import { cn } from '../lib/utils'

interface Plan {
  id: string
  name: string
  price: string
  unit: string
  summary: string
  rows: { term: string; value: ReactNode }[]
  action: ReactNode
}

const PLANS: Plan[] = [
  {
    id: 'hosted',
    name: 'Hosted',
    price: '$0',
    unit: 'no paid tier',
    summary: 'Sign in and open a workspace on the public instance. Nothing to install.',
    rows: [
      { term: 'You pay', value: 'Nothing. There is no card on file and no trial to run out.' },
      { term: 'Your data', value: 'In the hosted instance’s Supabase project.' },
      {
        term: 'Limits',
        value: '10 members per workspace, 5 owned workspaces, 10 images per bug, 30 bugs a minute.',
      },
      { term: 'Support', value: 'GitHub issues, answered when the maintainer can.' },
      { term: 'SLA', value: 'None. It is offered as is.' },
    ],
    action: <OpenWorkspaceLink size="lg" className="w-full" />,
  },
  {
    id: 'self-hosted',
    name: 'Self-hosted',
    price: '$0',
    unit: 'for the software',
    summary: 'Run the same code on your own Supabase project and any static host.',
    rows: [
      {
        term: 'You pay',
        value:
          'Your Supabase and hosting bills, at their prices. Their free tiers are enough to start; their limits apply.',
      },
      { term: 'Your data', value: 'In your Supabase project, under your account.' },
      {
        term: 'Limits',
        value: 'The same defaults, set in the SQL migrations. It is your copy: change them.',
      },
      { term: 'Support', value: 'The docs, and GitHub issues like everyone else.' },
      { term: 'License', value: `${facts.license}. Fork it, modify it, run it commercially.` },
    ],
    action: (
      <Link to="/docs/self-host" className={buttonClass('secondary', 'lg', 'w-full')}>
        Read the self-host guide
      </Link>
    ),
  },
]

const COMPARE: { feature: string; hosted: boolean; self: boolean }[] = [
  { feature: 'Every feature, including Claude Code', hosted: true, self: true },
  { feature: 'Unlimited bugs and comments (within the rate limits)', hosted: true, self: true },
  { feature: 'Google and magic-link sign-in', hosted: true, self: true },
  { feature: 'Your own domain', hosted: false, self: true },
  { feature: 'Change the limits and the code', hosted: false, self: true },
  { feature: 'An uptime guarantee', hosted: false, self: false },
]

function Mark({ on, label }: { on: boolean; label: string }) {
  return on ? (
    <Check size={16} aria-label={`${label}: yes`} className="text-success" />
  ) : (
    <Minus size={16} aria-label={`${label}: no`} className="text-ink-3" />
  )
}

function PlanCard({ plan, index }: { plan: Plan; index: number }) {
  return (
    <Reveal delay={index * 80} className="h-full">
      <article
        aria-labelledby={`${plan.id}-heading`}
        className={cn(
          'flex h-full flex-col rounded-xl border bg-surface-2 p-6 sm:p-8',
          index === 0 ? 'border-line-2 shadow-elev-3' : 'border-line shadow-elev-1',
        )}
      >
        <p className="specimen-label text-ink-3">
          <span className="text-accent">{String(index + 1).padStart(2, '0')}</span> · {plan.name}
        </p>
        <h2 id={`${plan.id}-heading`} className="mt-5 flex items-baseline gap-3">
          <span className="sr-only">{plan.name}: </span>
          <span className="text-[3.5rem]/none font-semibold tracking-[-0.04em] tabular-nums">
            {plan.price}
          </span>
          <span className="specimen-label text-ink-3">{plan.unit}</span>
        </h2>
        <p className="mt-4 text-read text-pretty text-ink-2">{plan.summary}</p>
        <dl className="mt-8 flex-1 border-b border-line">
          {plan.rows.map((row) => (
            <div
              key={row.term}
              className="grid gap-1 border-t border-line py-3 sm:grid-cols-[7rem_minmax(0,1fr)] sm:gap-4"
            >
              <dt className="specimen-label pt-0.5 text-ink-3">{row.term}</dt>
              <dd className="text-sm text-pretty text-ink">{row.value}</dd>
            </div>
          ))}
        </dl>
        <div className="mt-8">{plan.action}</div>
      </article>
    </Reveal>
  )
}

export default function Pricing() {
  usePageTitle('Pricing')
  return (
    <MarketingLayout>
      <PageHero eyebrow={['Pricing', 'Free', facts.license]} title="Free. MIT licensed.">
        <p>
          Use the hosted instance at no cost, or run it on your own Supabase. There is no paid tier,
          no trial and no per-seat price, so there is nothing to upgrade to.
        </p>
      </PageHero>

      <section aria-label="Ways to run Squash" className="border-t border-line py-16 lg:py-24">
        <div className={cn(MK_CONTAINER, 'grid gap-6 lg:grid-cols-2 lg:gap-8')}>
          {PLANS.map((plan, i) => (
            <PlanCard key={plan.id} plan={plan} index={i} />
          ))}
        </div>
      </section>

      <section aria-labelledby="compare-heading" className="border-t border-line py-16 lg:py-24">
        <div className={cn(MK_CONTAINER, 'grid gap-10 lg:grid-cols-12 lg:gap-8')}>
          <Reveal className="lg:col-span-4">
            <SectionHead id="compare-heading" eyebrow="Side by side" title="Same app, either way.">
              <p>
                The hosted instance runs this open-source code. Self-hosting adds control, not
                features.
              </p>
            </SectionHead>
          </Reveal>
          <Reveal delay={80} className="lg:col-span-8">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[30rem] border-collapse text-left">
                <thead>
                  <tr className="specimen-label text-ink-3">
                    <th scope="col" className="py-2 pr-4 font-normal">
                      <span className="sr-only">Feature</span>
                    </th>
                    <th scope="col" className="w-28 py-2 font-normal">
                      Hosted
                    </th>
                    <th scope="col" className="w-28 py-2 font-normal">
                      Self-hosted
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {COMPARE.map((row) => (
                    <tr key={row.feature} className="border-t border-line">
                      <th scope="row" className="py-3 pr-4 text-base font-normal text-ink">
                        {row.feature}
                      </th>
                      <td className="py-3">
                        <Mark on={row.hosted} label="Hosted" />
                      </td>
                      <td className="py-3">
                        <Mark on={row.self} label="Self-hosted" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Reveal>
        </div>
      </section>

      <section aria-labelledby="fine-print-heading" className="border-t border-line py-16 lg:py-24">
        <div className={cn(MK_CONTAINER, 'grid gap-10 lg:grid-cols-12 lg:gap-8')}>
          <Reveal className="lg:col-span-4">
            <SectionHead
              id="fine-print-heading"
              eyebrow="The fine print"
              title="What free means here."
            />
          </Reveal>
          <Reveal delay={80} className="space-y-5 text-read text-pretty text-ink-2 lg:col-span-7">
            <p>
              Squash is an open-source project. The hosted instance is a convenience run by its
              maintainer, without a company, a support contract or an uptime promise behind it. If
              you need those, self-host: your data and your uptime are then in your own hands.
            </p>
            <p>
              Every release is in the changelog ({facts.releases} so far), and every rule the hosted
              instance enforces is in the SQL migrations you can read.
            </p>
            <div className="flex flex-wrap gap-x-8">
              <Link to="/status" className={arrowLinkClass}>
                Check the status
                <ArrowRight size={16} aria-hidden="true" />
              </Link>
              <Link to="/terms" className={arrowLinkClass}>
                Read the terms
                <ArrowRight size={16} aria-hidden="true" />
              </Link>
              <a href={githubUrl()} className={arrowLinkClass}>
                Browse the source
                <ArrowRight size={16} aria-hidden="true" />
              </a>
            </div>
          </Reveal>
        </div>
      </section>

      <ActionBand title="Open a workspace. It costs nothing." />
    </MarketingLayout>
  )
}
