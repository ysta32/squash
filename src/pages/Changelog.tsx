import { ArrowUpRight, Link2, Rss } from 'lucide-react'
import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { ActionBand } from '../components/marketing/ActionBand'
import { content } from '../components/marketing/content'
import type { ChangelogContent } from '../components/marketing/content-types'
import { githubUrl } from '../components/marketing/links'
import { MK_CONTAINER, MarketingLayout } from '../components/marketing/MarketingLayout'
import { PageHero } from '../components/marketing/PageHero'
import { Prose } from '../components/marketing/Prose'
import { useSiteJson } from '../components/marketing/siteJson'
import { usePageTitle } from '../components/marketing/usePageTitle'
import { Button, SpecimenLabel, buttonClass } from '../components/ui'
import { cn } from '../lib/utils'

/** `2026-10-07` → `07 OCT 2026`, the specimen-label date (UTC, so it never shifts a day). */
function labelDate(isoDay: string): string {
  return new Date(`${isoDay}T00:00:00Z`)
    .toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      timeZone: 'UTC',
    })
    .toUpperCase()
}

function BodySkeleton() {
  return (
    <div aria-hidden="true" className="space-y-3">
      <div className="h-4 w-2/3 animate-skeleton rounded-sm bg-surface-3" />
      <div className="h-4 w-5/6 animate-skeleton rounded-sm bg-surface-3" />
      <div className="h-4 w-1/2 animate-skeleton rounded-sm bg-surface-3" />
    </div>
  )
}

/** Scrolls to `#v1.6.0` once the entries above it have their full height. */
function useScrollToHash(ready: boolean) {
  const { hash } = useLocation()
  useEffect(() => {
    if (!ready || !hash) return
    document.getElementById(decodeURIComponent(hash.slice(1)))?.scrollIntoView({ block: 'start' })
  }, [ready, hash])
}

export default function Changelog() {
  usePageTitle('Changelog')
  const log = useSiteJson<ChangelogContent>('/content/changelog.json')
  useScrollToHash(log.state !== 'loading')
  const latest = content.releases[0]
  const bodies = new Map(
    log.state === 'ready' ? log.data.releases.map((release) => [release.id, release]) : [],
  )

  return (
    <MarketingLayout>
      <PageHero
        eyebrow={['Changelog', `${content.releases.length} releases`, `Latest ${latest.version}`]}
        title="What changed, release by release."
        actions={
          <>
            <a href="/changelog.xml" className={buttonClass('secondary', 'lg')}>
              <Rss size={16} aria-hidden="true" />
              RSS feed
            </a>
            <a href={`${githubUrl()}/releases`} className={buttonClass('ghost', 'lg')}>
              GitHub releases
              <ArrowUpRight size={16} aria-hidden="true" />
            </a>
          </>
        }
      >
        <p>
          Every release of Squash, written from what you will notice in the app. Built from{' '}
          <code className="rounded-sm border border-line bg-surface-1 px-1 font-mono text-[0.9em] text-ink">
            CHANGELOG.md
          </code>{' '}
          in the repository when this site is deployed.
        </p>
      </PageHero>

      <div className="border-t border-line">
        <div className={cn(MK_CONTAINER, 'grid gap-12 py-16 lg:grid-cols-12 lg:gap-8 lg:py-24')}>
          <nav aria-label="Releases" className="max-lg:hidden lg:col-span-3">
            <div className="sticky top-28">
              <p className="specimen-label text-ink-3">Releases</p>
              <ol className="mt-3 border-t border-line">
                {content.releases.map((release) => (
                  <li key={release.id} className="border-b border-line">
                    <a
                      href={`#${release.id}`}
                      className="t focus-ring-inset flex h-10 items-center justify-between gap-3 text-sm text-ink-2 hover:text-ink"
                    >
                      <span className="font-mono font-medium tabular-nums">{release.version}</span>
                      <time dateTime={release.date} className="specimen-label text-ink-3">
                        {labelDate(release.date)}
                      </time>
                    </a>
                  </li>
                ))}
              </ol>
            </div>
          </nav>

          <div className="min-w-0 lg:col-span-8 lg:col-start-5">
            {log.state === 'error' && (
              <div role="alert" className="mb-12 rounded-lg border border-danger/40 p-4 text-sm">
                <p className="text-danger">The release notes didn’t load: {log.message}.</p>
                <Button size="sm" className="mt-3" onClick={log.retry}>
                  Retry
                </Button>
              </div>
            )}

            <section aria-labelledby="unreleased" className="pb-14">
              <SpecimenLabel boxed as="div" segments={['Unreleased', 'Not in a release yet']} />
              <h2 id="unreleased" className="sr-only">
                Unreleased
              </h2>
              <div className="mt-5">
                {log.state === 'loading' ? (
                  <BodySkeleton />
                ) : log.state === 'ready' && log.data.unreleased && !log.data.unreleased.empty ? (
                  <Prose html={log.data.unreleased.html} />
                ) : log.state === 'ready' ? (
                  <p className="text-read text-ink-3">Nothing has landed since {latest.version}.</p>
                ) : null}
              </div>
            </section>

            <ol className="space-y-0">
              {content.releases.map((release) => {
                const body = bodies.get(release.id)
                return (
                  <li key={release.id}>
                    <article
                      aria-labelledby={release.id}
                      className="scroll-mt-24 border-t border-line pt-10 pb-14"
                    >
                      <header className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
                        <h2
                          id={release.id}
                          className="group scroll-mt-24 font-mono text-2xl font-medium tracking-[-0.02em] tabular-nums"
                        >
                          <a
                            href={`#${release.id}`}
                            className="focus-ring inline-flex items-center gap-2 rounded-sm"
                          >
                            {release.version}
                            <Link2
                              size={16}
                              aria-hidden="true"
                              className="t text-ink-3 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100"
                            />
                          </a>
                        </h2>
                        <time dateTime={release.date} className="specimen-label text-ink-3">
                          {labelDate(release.date)}
                        </time>
                      </header>
                      {body?.summary && (
                        <p
                          className="mt-4 max-w-[56ch] text-lg leading-8 font-medium text-pretty text-ink"
                          dangerouslySetInnerHTML={{ __html: body.summary }}
                        />
                      )}
                      <div className="mt-6">
                        {body ? (
                          <Prose html={body.html} />
                        ) : (
                          log.state === 'loading' && <BodySkeleton />
                        )}
                      </div>
                    </article>
                  </li>
                )
              })}
            </ol>
          </div>
        </div>
      </div>

      <ActionBand title="Try what shipped.">
        <p>Open a workspace on the hosted instance, or follow new releases with the RSS feed.</p>
      </ActionBand>
    </MarketingLayout>
  )
}
