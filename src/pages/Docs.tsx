import { ArrowRight } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { ActionBand } from '../components/marketing/ActionBand'
import { content } from '../components/marketing/content'
import type { DocBody } from '../components/marketing/content-types'
import { DOC_GROUPS, DOC_LINKS } from '../components/marketing/docLinks'
import { DocsLayout } from '../components/marketing/DocsLayout'
import { MK_CONTAINER, MarketingLayout } from '../components/marketing/MarketingLayout'
import { PageHero } from '../components/marketing/PageHero'
import { Prose } from '../components/marketing/Prose'
import { Reveal } from '../components/marketing/Reveal'
import { ShortcutTable } from '../components/marketing/Shortcuts'
import { useSiteJson } from '../components/marketing/siteJson'
import { usePageTitle } from '../components/marketing/usePageTitle'
import { SHORTCUTS_SLOT } from '../components/marketing/slots'
import { Button } from '../components/ui'
import { cn } from '../lib/utils'
import NotFound from './NotFound'

function DocSkeleton() {
  return (
    <div role="status" aria-label="Loading the page" className="space-y-3">
      {['w-5/6', 'w-full', 'w-2/3', 'w-4/5', 'w-1/2'].map((width, i) => (
        <div key={i} className={cn('h-4 animate-skeleton rounded-sm bg-surface-3', width)} />
      ))}
    </div>
  )
}

function DocPage({ slug }: { slug: string }) {
  const meta = content.docs.find((doc) => doc.slug === slug)!
  usePageTitle(`${meta.title} · Docs`)
  const body = useSiteJson<DocBody>(`/content/docs/${slug}.json`)
  return (
    <DocsLayout current={slug} headings={meta.headings}>
      {body.state === 'loading' && <DocSkeleton />}
      {body.state === 'error' && (
        <div role="alert" className="rounded-lg border border-danger/40 p-4 text-sm">
          <p className="text-danger">This page didn’t load: {body.message}.</p>
          <Button size="sm" className="mt-3" onClick={body.retry}>
            Retry
          </Button>
        </div>
      )}
      {body.state === 'ready' && (
        <Prose
          html={body.data.html}
          slots={{ [SHORTCUTS_SLOT]: <ShortcutTable className="max-w-[40rem]" /> }}
        />
      )}
    </DocsLayout>
  )
}

function DocsIndex() {
  usePageTitle('Docs')
  return (
    <MarketingLayout>
      <PageHero
        eyebrow={['Docs', `${DOC_LINKS.length} pages`]}
        title="Run, use and self-host Squash."
      >
        <p>
          How the app works, from the first bug to Claude Code, and how to run your own copy on a
          free Supabase project. Written from the code in the repository, not from a roadmap.
        </p>
      </PageHero>
      {DOC_GROUPS.map((group, g) => (
        <section
          key={group.id}
          aria-labelledby={`docs-${group.id}`}
          className="border-t border-line py-14 lg:py-20"
        >
          <div className={cn(MK_CONTAINER, 'grid gap-8 lg:grid-cols-12')}>
            <Reveal className="lg:col-span-4">
              <p className="specimen-label text-ink-3">
                <span className="text-accent">{String(g + 1).padStart(2, '0')}</span> · Section
              </p>
              <h2
                id={`docs-${group.id}`}
                className="mt-3 text-[2rem]/[2.4rem] font-semibold tracking-[-0.025em] sm:text-display-s"
              >
                {group.title}
              </h2>
            </Reveal>
            <Reveal delay={80} className="lg:col-span-8">
              <ul className="border-b border-line">
                {DOC_LINKS.filter((doc) => doc.group === group.id).map((doc) => (
                  <li key={doc.slug} className="border-t border-line">
                    <Link
                      to={doc.path}
                      className="t focus-ring-inset group grid gap-1 py-5 sm:grid-cols-[minmax(0,2fr)_minmax(0,3fr)_1.5rem] sm:items-baseline sm:gap-8"
                    >
                      <span className="text-lg font-medium tracking-[-0.01em] group-hover:text-accent">
                        {doc.title}
                      </span>
                      <span className="text-base text-pretty text-ink-2">{doc.description}</span>
                      <ArrowRight
                        size={16}
                        aria-hidden="true"
                        className="t text-ink-3 group-hover:translate-x-0.5 group-hover:text-accent max-sm:hidden"
                      />
                    </Link>
                  </li>
                ))}
              </ul>
            </Reveal>
          </div>
        </section>
      ))}
      <ActionBand
        title="Start with one bug."
        secondary={{ label: 'Getting started', to: '/docs/getting-started' }}
      >
        <p>Open a workspace on the hosted instance; no setup is needed to file the first bug.</p>
      </ActionBand>
    </MarketingLayout>
  )
}

/** /docs (the index) and /docs/:slug (one Markdown page); unknown pages get the 404. */
export default function Docs() {
  const { slug } = useParams<{ slug?: string }>()
  if (!slug) return <DocsIndex />
  if (!content.docs.some((doc) => doc.slug === slug)) return <NotFound />
  // Keyed so a new page starts with fresh loading state.
  return <DocPage key={slug} slug={slug} />
}
